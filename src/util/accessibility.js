/**
 * Add accessibility features to help support announcing events and content changes for screen readers.
 *
 * @since 5.2.0
 */

/**
 * Create the announcement element
 */
export default function createAnnouncementElement() {
    var exists = document.getElementById("announce-waveform");
    var announcement;
    var id = "announce-waveform";
    
    if(!exists){
        announcement = document.createElement("div");        
        announcement.setAttribute("id", id);
        announcement.setAttribute("aria-live", "polite");
        announcement.classList.add("sr-only");
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
