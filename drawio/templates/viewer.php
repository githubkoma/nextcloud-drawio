<?php
/**
 *
 * @author Pawel Rojek <pawel at pawelrojek.com>
 * @author Ian Reinhart Geiser <igeiser at devonit.com>
 * @author Arno Welzel <privat at arnowelzel.de>
 *
 * This file is licensed under the Affero General Public License version 3 or later.
 *
 **/

    style("drawio", "editor");
    script("drawio", "editor");
    script("drawio", "viewer");


    $frame_params = "?embed=1";
    if ($_["drawioOfflineMode"] == "yes")
    {
        $frame_params .= "&offline=1&stealth=1";
    }
    if (!empty($_["drawioTheme"])) $frame_params .= "&ui=".$_["drawioTheme"];
    if (!empty($_["drawioLang"])) $frame_params .= "&lang=".$_["drawioLang"];
    if (!empty($_["drawioUrlArgs"])) $frame_params .= "&".$_["drawioUrlArgs"];

    if ($_['drawioReadOnly']) {
        $frame_params .= "&chrome=0"; //read-only viewer
    }

    $frame_params .= "&spin=1&proto=json";

    $finalAutosave = $_['drawioAutosave'];
    if ($_['drawioReadOnly']) $finalAutosave = false;
?>

<div id="app-content">
    <iframe id="iframeEditor" data-sharetoken="<?php p($_["shareToken"]) ?>" width="100%" height="100%" align="top" frameborder="0" name="iframeEditor" onmousewheel="" allowfullscreen=""></iframe>

    <script type="text/javascript" nonce="<?php p(base64_encode($_["requesttoken"])) ?>" defer>
        window.addEventListener('DOMContentLoaded', function() {
            <?php if (!empty($_['error'])) { ?>
                OCA.DrawIO.DisplayError("<?php p($_['error']) ?>");
            <?php } else { ?>
                var iframe = document.getElementById("iframeEditor");
                var filePath = <?php echo json_encode(urldecode($_['drawioFilePath'])); ?>;
                var originUrl = "<?php p($_['drawioUrl']); ?>";
                var drawIoUrl = "<?php p($_['drawioUrl']); print_unescaped($frame_params); ?>"
                var originUrl = "<?php p($_['drawioUrl']); ?>";
                var autosave = "<?php p($finalAutosave); ?>";
                var basicsync = "<?php p($_['drawioBasicSync']);?>";
                OCA.DrawIO.EditFile(iframe.contentWindow, filePath, originUrl, autosave, basicsync);
                iframe.setAttribute('src', drawIoUrl);
            <?php } ?>
        });
    </script>
</div>