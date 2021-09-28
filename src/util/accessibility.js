/**
 * Add accessibility features to help support announcing events and content changes for screen readers.
 *
 * @since 5.2.0
 */

/**
 * Create the announcement element
 */
export default function createAnnouncementElement() {
    var announcement = document.getElementById("announce-waveform");
    var id = "announce-waveform";
    
    if(!announcement){
        announcement = document.createElement("div");        
        announcement.setAttribute("id", id);
        announcement.setAttribute("aria-live", "polite");
        var styles = {
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: '0',
            margin: '-1',
            overflow: 'hidden',
            clip: 'rect(0,0,0,0)',
            white-space: 'nowrap',
            border: '0'            
        };
        Object.keys(styles).forEach(prop => {
            if (announcement.style[prop] !== styles[prop]) {
                announcement.style[prop] = styles[prop];
            }
        });
        document.body.appendChild(announcement);
    }
    document.getElementById(id).innerHTML = "Loading waveform";
}

/**
 * Update the announcement text
 */
export default function updateAnnouncementText(message) {
    document.getElementById("announce-waveform").innerHTML = message;
}

/**
 * Clear the announcement text
 */
export default function clearAnnouncementText() {
    document.getElementById("announce-waveform").innerHTML = "";
}
