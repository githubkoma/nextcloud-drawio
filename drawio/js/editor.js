/**
 *
 * @author Pawel Rojek <pawel at pawelrojek.com>
 * @author Ian Reinhart Geiser <igeiser at devonit.com>
 *
 * This file is licensed under the Affero General Public License version 3 or later.
 *
 **/

(function (OCA) {

    // ADD SUPPORT TO IE
    if (!String.prototype.includes) {
        String.prototype.includes = function(search, start) {
            if (typeof start !== 'number') {
                start = 0;
            }
            if (start + search.length > this.length) {
                return false;
            } else {
                return this.indexOf(search, start) !== -1;
            }
        };
    }

    OCA.DrawIO = _.extend({}, OCA.DrawIO);
    if (!OCA.DrawIO.AppName) {
        OCA.DrawIO = {
            AppName: "drawio"
        };
    }

    OCA.DrawIO.DisplayError = function (error) {
        $("#app")
        .text(error)
        .addClass("error");
    };

    OCA.DrawIO.Cleanup = function (receiver, filePath) {
        window.removeEventListener("message", receiver);

        var ncClient = OC.Files.getClient();
        ncClient.getFileInfo(filePath)
        .then(function (status, fileInfo) {
            var url = OC.generateUrl("/apps/files/?dir={currentDirectory}&fileid={fileId}", {
                currentDirectory: fileInfo.path,
                fileId: fileInfo.id
            });
            window.location.href = url;
        })
        .fail(function () {
            var url = OC.generateUrl("/apps/files");
            window.location.href = url;
        });
    };

    OCA.DrawIO.EditFile = function (editWindow, filePath, origin,  autosave, basicsync) {
        var ncClient = OC.Files.getClient();
        var autosaveEnabled = autosave === "yes";
        var basicSyncEnabled = basicsync === "yes";
        window.lastDiagram = null; // Place to cache the diagram for future comparing purposes
        var fileId = $("#iframeEditor").data("id");
        var shareToken = $("#iframeEditor").data("sharetoken");
        if (!fileId && !shareToken) {
            displayError(t(OCA.DrawIO.AppName, "FileId is empty"));
            return;
        }
        if(shareToken) {
            var fileUrl = OC.generateUrl("apps/" + OCA.DrawIO.AppName + "/ajax/shared/{fileId}", { fileId: fileId || 0 });
            var params = [];
            if (filePath) {
                params.push("filePath=" + encodeURIComponent(filePath));
            }
            if (shareToken) {
                params.push("shareToken=" + encodeURIComponent(shareToken));
            }
            if (params.length) {
                fileUrl += "?" + params.join("&");
            }
        }
        var receiver = function (evt) {
            if (evt.data.length > 0 && origin.includes(evt.origin)) {
                var payload = JSON.parse(evt.data);
                if (payload.event === "init") {
                    var loadMsg = OC.Notification.show(t(OCA.DrawIO.AppName, "Loading, please wait."));
		    if(!fileId) {
		        $.ajax({
        		    url: fileUrl,
		            success: function onSuccess(data) {
                                    editWindow.postMessage(JSON.stringify({
		                            action: "load",
	                                    xml: data
    		                    }), "*");
                		    OC.Notification.hide(loadMsg);
                            window.lastDiagram = data; // Cache the recently saved diagram for future comparing purposes
			    },
			    fail: function (status) {

                                console.log("Status Error: " + status);
	                        // TODO: show error on failed read
    	                        OCA.DrawIO.Cleanup(receiver, filePath);
			    },
			    done: function() {
                                OC.Notification.hide(loadMsg);
			    }
			});
                
                // Basic Sync: Every XXXX Milliseconds, reloads the whole XML File and merges its contents into the current Diagram
                if (basicSyncEnabled) {
                    setInterval(function(){                        
                        if (new Blob([window.lastDiagram]).size < 150000) { // max sync filesize in Byte
                            editWindow.postMessage(JSON.stringify({action: 'status', message: "Syncing.. ", modified: false }), '*');
                            $.ajax({
                                url: fileUrl,
                                success: function onSuccess(data) {
                                    if (window.lastDiagram !== data) {
                                        console.log("content differs, old hash: " + window.lastDiagram.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0));
                                        console.log("new hash: " + data.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0)); 
                                        window.lastDiagram = data;
                                        editWindow.postMessage(JSON.stringify({
                                            action: "merge",                                                
                                            xml: data
                                        }), "*");                                        
                                    }
                                    editWindow.postMessage(JSON.stringify({action: 'status', message: "", modified: false }), '*');
                                }                       
                            })
                        } else {
                            editWindow.postMessage(JSON.stringify({action: 'status', message: "Not Syncing, file too big.. ", modified: false }), '*');
                        }   
                    }, 7000);
                }

		    } else {
                    ncClient.getFileContents(filePath)
                    .then(function (status, contents) {
                        if (contents === " ") {
                            OCA.DrawIO.NewFileMode = true; //[workaround] "loading" file without content, to display "template" later in "load" callback event without another filename prompt
                            editWindow.postMessage(JSON.stringify({
                                action: "load",
                                autosave: Number(autosaveEnabled)
                            }), "*");
                        } else if (contents.indexOf("mxfile") == -1 || contents.indexOf("diagram") == -1) {
                            // TODO: show error to user
                            OCA.DrawIO.Cleanup(receiver, filePath);
                        } else {
                            OCA.DrawIO.NewFileMode = false;
                            editWindow.postMessage(JSON.stringify({
                                action: "load",
                                autosave: Number(autosaveEnabled),
                                xml: contents
                            }), "*");
                            window.lastDiagram = contents; // Cache the recently saved diagram for future comparing purposes
                        }
                    })
                    .fail(function (status) {
                        console.log("Status Error: " + status);
                        // TODO: show error on failed read
                        OCA.DrawIO.Cleanup(receiver, filePath);
                    })
                    .done(function () {
                        OC.Notification.hide(loadMsg);
                    });

                    // Basic Sync: Every XXXX Milliseconds, reloads the whole XML File and merges its contents into the current Diagram
                    if (basicSyncEnabled) {                        
                        setInterval(function(){
                            if (new Blob([window.lastDiagram]).size < 150000) { // max sync filesize in Byte
                                editWindow.postMessage(JSON.stringify({action: 'status', message: "Syncing.. ", modified: false }), '*');
                                ncClient.getFileContents(filePath)
                                    .then(function (status, contents) {                                    
                                        if (window.lastDiagram !== contents) {
                                            console.log("content differs, old hash: " + window.lastDiagram.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0));
                                            console.log("new hash: " + contents.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0)); 
                                            window.lastDiagram = contents;
                                            editWindow.postMessage(JSON.stringify({
                                                action: "merge",                                                
                                                xml: contents
                                            }), "*");                                            
                                        }
                                        editWindow.postMessage(JSON.stringify({action: 'status', message: "", modified: false }), '*');
                                    })                                 
                            } else {
                                editWindow.postMessage(JSON.stringify({action: 'status', message: "Not Syncing, file too big.. ", modified: false }), '*');
                            }                            
                        }, 7000);
                    }

        }
                } else if (payload.event === "template") {
                  //template selected
                } else if (payload.event === "load") {
                   if (OCA.DrawIO.NewFileMode) {
                       editWindow.postMessage(JSON.stringify({
                             action: "template"
                      }), "*");
                   }
                } else if (payload.event === "export") {
                    // TODO: handle export event
                } else if (payload.event === "autosave") {
                    var time = new Date();
                    ncClient.putFileContents(
                        filePath,
                        payload.xml, {
                            contentType: "application/x-drawio",
                            overwrite: false
                        }
                    )
                    .then(function (status) {
                        editWindow.postMessage(JSON.stringify({
                            action: 'status',
                            message: "Autosave successful at " + time.toLocaleTimeString(),
                            modified: false
                        }), '*');
                        window.lastDiagram = payload.xml; // Cache the recently saved diagram for future comparing purposes
                        if (basicSyncEnabled) { console.log("Saved with hash: " + payload.xml.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0))};
                    })
                    .fail(function (status) {
                        editWindow.postMessage(JSON.stringify({
                            action: 'status',
                            message: "Autosave failed at " + time.toLocaleTimeString(),
                            modified: false
                        }), '*');
                    });
                } else if (payload.event === "save") {
                    var saveMsg = OC.Notification.show(t(OCA.DrawIO.AppName, "Saving..."));
                    ncClient.putFileContents(
                        filePath,
                        payload.xml, {
                            contentType: "application/x-drawio",
                            overwrite: false
                        }
                    )
                    .then(function (status) {
                        OC.Notification.showTemporary(t(OCA.DrawIO.AppName, "File saved!"));
                        window.lastDiagram = payload.xml; // Cache the recently saved diagram for future comparing purposes
                        if (basicSyncEnabled) { console.log("Saved with hash: " + payload.xml.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0))};
                    })
                    .fail(function (status) {
                        // TODO: handle on failed write
                        OC.Notification.showTemporary(t(OCA.DrawIO.AppName, "File not saved!"));
                    })
                    .done(function () {
                        OC.Notification.hide(saveMsg);
                    });
                } else if (payload.event === "exit") {
                    OCA.DrawIO.Cleanup(receiver, filePath);
                } else {
                    console.log("DrawIO Integration: unknown event " + payload.event);
                    console.dir(payload);
                }
            } else {
                console.log("DrawIO Integration: bad origin " + evt.origin);
            }
        }
        window.addEventListener("message", receiver);
    }
})(OCA);
