/*!
 * videojs-caption
 */

import videojs from 'video.js';
const Plugin = videojs.getPlugin('plugin');

// Default options
const defaults = {
  captionSize: 3,
  captionStyle: {
    backgroundColor: "rgba(0,0,0,0.8)",
    color: 'white',
    padding: "3px"
  },
  onCaptionChange: () => {},
  captionType: "pop-on" // 'pop-on' or 'roll-up'
};

const fontSizeTable = [
  '0.75em', '0.85em', '0.95em', '1em', '1.05em', '1.15em', '1.25em', '1.35em', '1.45em'
];

/**
 * Caption VideoJS plugin
 * Provides advanced caption display with positioning and styling
 */
class Caption extends Plugin {
  constructor(player, options) {
    super(player);

    this.options = videojs.mergeOptions(defaults, options);
    this.captionData = this.options.data || [];
    this.captionSize = this.options.captionSize;
    this.captionType = this.options.captionType;

    this.rowCursorID = -1;
    this.captionRows = [];
    this.captionRowsRender = [];
    this.captionRowsCache = [];
    this.captionRowsRenderCache = [];
    this.captionEl = null;

    // Setup event listeners
    this.player.on('timeupdate', this.handleTimeUpdate.bind(this));

    // Initialize
    this.createCaptionEl();
  }

  /**
   * Create the caption DOM element
   */
  createCaptionEl() {
    if (!this.captionEl) {
      this.captionEl = document.createElement('div');
      this.captionEl.className = 'vjs-caption-overlay';
      this.player.el().appendChild(this.captionEl);

      // Apply styles
      Object.assign(this.captionEl.style, {
        position: 'absolute',
        zIndex: '1',
        width: '100%',
        textAlign: 'center',
        pointerEvents: 'none',
        fontSize: fontSizeTable[this.captionSize],
        ...this.options.captionStyle
      });
    }
    return this.captionEl;
  }

  /**
   * Handle timeupdate events
   */
  handleTimeUpdate() {
    this.processCaptions(this.player.currentTime());
  }

  /**
   * Update caption display with current captions
   */
  updateCaption() {
    const el = this.captionEl;

    // Clear existing captions
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }

    if (this.captionType === "roll-up") {
      // Roll-up mode
      this.captionRowsRender.forEach(caption => {
        const line = document.createElement('div');
        line.className = 'vjs-caption-line';
        line.innerHTML = caption.data;
        el.appendChild(line);
      });
    } else {
      // Pop-on mode
      this.captionRowsRender.forEach(row => {
        const line = document.createElement('div');
        line.className = 'vjs-caption-line';

        // Position classes
        if (row.position === 'HT') {
          line.classList.add('vjs-caption-top');
        } else if (row.position === 'VR') {
          line.classList.add('vjs-caption-right');
        } else if (row.position === 'VL') {
          line.classList.add('vjs-caption-left');
        } else {
          line.classList.add('vjs-caption-bottom'); // Default HB
        }

        // Alignment classes
        if (row.alignment === 'L') {
          line.classList.add('vjs-caption-align-left');
        } else {
          line.classList.add('vjs-caption-align-center'); // Default C
        }

        line.innerHTML = row.data;
        el.appendChild(line);
      });
    }
  }

  /**
   * Process caption data for the current time
   * @param {number} time - Current playback time in seconds
   */
  processCaptions(time) {
    const currentTime = time * 1000; // Convert to milliseconds
    const newRows = [];
    const newRowsRender = [];

    // Find captions that should be displayed at the current time
    this.captionData.forEach((caption, index) => {
      if (currentTime >= caption.startTime && currentTime <= caption.endTime) {
        newRows.push(caption);

        // Create render object with position and alignment
        const renderObj = {
          data: caption.data || caption.text,
          position: caption.position || 'HB', // Default to horizontal bottom
          alignment: caption.alignment || 'C'  // Default to center
        };

        newRowsRender.push(renderObj);

        // Trigger callback if this is a new caption
        if (!this.captionRows.includes(caption) && typeof this.options.onCaptionChange === 'function') {
          this.options.onCaptionChange(caption.id || index);
        }
      }
    });

    // Handle roll-up captions differently
    if (this.captionType === "roll-up") {
      let shouldUpdate = false;

      // If we have new captions
      if (newRows.length > 0) {
        const lastNewRow = newRows[newRows.length - 1];
        this.rowCursorID = lastNewRow.id || this.captionData.indexOf(lastNewRow);

        // Check if this is a new row to add
        if (!this.captionRowsCache.includes(lastNewRow)) {
          this.captionRowsCache.push(lastNewRow);
          this.captionRowsRenderCache.push({
            data: lastNewRow.data || lastNewRow.text,
            position: 'HB',
            alignment: 'C'
          });
          shouldUpdate = true;
        }
      } else {
        // No captions at current time, clear the roll-up
        if (this.captionRowsCache.length > 0) {
          this.captionRowsCache = [];
          this.captionRowsRenderCache = [];
          shouldUpdate = true;
        }
      }

      // Update the display rows
      this.captionRows = [...this.captionRowsCache];
      this.captionRowsRender = [...this.captionRowsRenderCache];

      if (shouldUpdate) {
        this.updateCaption();
      }
    } else {
      // For pop-on mode, just replace all captions
      this.captionRows = newRows;
      this.captionRowsRender = newRowsRender;
      this.updateCaption();
    }
  }

  /**
   * API: Update captions at current time
   */
  update() {
    this.processCaptions(this.player.currentTime());
  }

  /**
   * API: Load new caption data
   * @param {Array} data - Caption data array
   */
  loadNewCaption(data) {
    this.captionData = data || [];
    this.captionRows = [];
    this.captionRowsRender = [];
    this.captionRowsCache = [];
    this.captionRowsRenderCache = [];
    this.rowCursorID = -1;
    this.player.pause();
    this.player.currentTime(0);
    this.processCaptions(0);
  }

  /**
   * API: Get current row cursor ID
   * @return {number} The row cursor ID
   */
  getRowCursorID() {
    return this.rowCursorID;
  }

  /**
   * API: Get caption data
   * @return {Array} The caption data
   */
  getCaptionData() {
    return this.captionData;
  }

  /**
   * API: Increase font size
   */
  increaseFontSize() {
    if (this.captionSize < fontSizeTable.length - 1) {
      this.captionSize++;
      this.captionEl.style.fontSize = fontSizeTable[this.captionSize];
    }
  }

  /**
   * API: Decrease font size
   */
  decreaseFontSize() {
    if (this.captionSize > 0) {
      this.captionSize--;
      this.captionEl.style.fontSize = fontSizeTable[this.captionSize];
    }
  }

  /**
   * API: Change to roll-up caption mode
   */
  changeToRollUp() {
    this.captionType = "roll-up";
    this.resetCaptions();
  }

  /**
   * API: Change to pop-on caption mode
   */
  changeToPopOn() {
    this.captionType = "pop-on";
    this.resetCaptions();
  }

  /**
   * Reset caption display
   */
  resetCaptions() {
    this.captionRows = [];
    this.captionRowsRender = [];
    this.captionRowsCache = [];
    this.captionRowsRenderCache = [];
    this.rowCursorID = -1;
    this.processCaptions(this.player.currentTime());
  }
}

// Register the plugin with Video.js
videojs.registerPlugin('caption', function(options) {
  return new Caption(this, options);
});

export default Caption;