/**
 * Add accessibility features to help support announcing events and content changes for screen readers.
 *
 * @since 5.2.0
 */

import style from './style';

export class Accessibility {
  constructor() {
    this.announcement = document.body.appendChild(
      document.createElement('div')
    );
    this.announcement.setAttribute('aria-live', 'polite');

    style(this.announcement, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1',
      overflow: 'hidden',
      clip: 'rect(0,0,0,0)',
      white-space: 'nowrap',
      border: '0'            
    });

    this.updateAnnouncementText('Loading waveform');
  }

  // update the announcement text element
  updateAnnouncementText(text) {
    this.announcement.textContent = text;
  }

  // clear the announcement text element
  clearAnnouncementText() {
    this.announcement.textContent = '';
  }

  // remove the announcement text element
  removeAnnouncementText() {
    this.announcement.remove();
  }
}




