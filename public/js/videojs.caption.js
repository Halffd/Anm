/*!
 * videojs-caption
 * @version 0.2.0
 * @copyright 2024 Samping Chuang
 * @license MIT
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['video.js', 'jquery'], factory);
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('video.js'), require('jquery'));
  } else {
    factory(root.videojs, root.jQuery);
  }
}(this, function (videojs, $) {
  'use strict';

  var defaults = {
    captionSize: 3,
    captionStyle: {
      'background-color': "rgba(0,0,0,0.8)",
      'color': 'white',
      'padding': "3px"
    },
    onCaptionChange: function() {},
    captionType: "pop-on"
  };

  var fontSizeTable = [
    '0.75em', '0.85em', '0.95em', '1em', '1.05em', '1.15em', '1.25em', '1.35em', '1.45em'
  ];

  /**
   * Initialize the plugin.
   * @param options (optional) {object} configuration for the plugin
   */
  videojs.plugin('caption', function (options) {
    var settings = videojs.mergeOptions(defaults, options);
    var player = this;
    var captionData = settings.data || [];
    var captionSize = settings.captionSize;
    var captionType = settings.captionType;
    var rowCursorID = -1;
    var captionRows = [];
    var captionRowsRender = [];
    var captionRowsCache = [];
    var captionRowsRenderCache = [];
    var captionEl = null;

    // Create caption DOM element
    function createCaptionEl() {
      if (!captionEl) {
        captionEl = document.createElement('div');
        captionEl.className = 'vjs-caption-overlay';
        player.el().appendChild(captionEl);
        
        // Apply base styles
        $(captionEl).css({
          'position': 'absolute',
          'z-index': 1,
          'width': '100%',
          'text-align': 'center',
          'pointer-events': 'none',
          'font-size': fontSizeTable[captionSize]
        });
        
        // Apply user-defined styles
        $(captionEl).css(settings.captionStyle);
      }
      return captionEl;
    }

    // Update caption display
    function updateCaption() {
      var el = createCaptionEl();
      var html = '';
      
      if (captionType === "roll-up") {
        for (var i = 0; i < captionRowsRender.length; i++) {
          html += '<div class="vjs-caption-line">' + captionRowsRender[i].data + '</div>';
        }
      } else { // pop-on mode
        for (var i = 0; i < captionRowsRender.length; i++) {
          var row = captionRowsRender[i];
          var positionClass = '';
          var alignmentClass = '';
          
          // Position classes
          if (row.position === 'HT') {
            positionClass = 'vjs-caption-top';
          } else if (row.position === 'VR') {
            positionClass = 'vjs-caption-right';
          } else if (row.position === 'VL') {
            positionClass = 'vjs-caption-left';
          } else {
            positionClass = 'vjs-caption-bottom'; // Default HB
          }
          
          // Alignment classes
          if (row.alignment === 'L') {
            alignmentClass = 'vjs-caption-align-left';
          } else {
            alignmentClass = 'vjs-caption-align-center'; // Default C
          }
          
          html += '<div class="vjs-caption-line ' + positionClass + ' ' + alignmentClass + '">' + row.data + '</div>';
        }
      }
      
      el.innerHTML = html;
    }

    // Process caption data for the current time
    function processCaptions(time) {
      var currentTime = time * 1000; // Convert to milliseconds
      var newRows = [];
      var newRowsRender = [];
      
      // Find captions that should be displayed at the current time
      for (var i = 0; i < captionData.length; i++) {
        var caption = captionData[i];
        if (currentTime >= caption.startTime && currentTime <= caption.endTime) {
          newRows.push(caption);
          
          // Create render object with position and alignment
          var renderObj = {
            data: caption.data || caption.text,
            position: caption.position || 'HB', // Default to horizontal bottom
            alignment: caption.alignment || 'C'  // Default to center
          };
          
          newRowsRender.push(renderObj);
          
          // Trigger callback if this is a new caption
          if (captionRows.indexOf(caption) === -1 && typeof settings.onCaptionChange === 'function') {
            settings.onCaptionChange(caption.id || i);
          }
        }
      }
      
      // Handle roll-up captions differently
      if (captionType === "roll-up") {
        // For roll-up, we only support bottom position
        // Check if we need to update the display
        var shouldUpdate = false;
        
        // If we have new captions
        if (newRows.length > 0) {
          var lastNewRow = newRows[newRows.length - 1];
          rowCursorID = lastNewRow.id || captionData.indexOf(lastNewRow);
          
          // Check if this is a new row to add
          if (captionRowsCache.indexOf(lastNewRow) === -1) {
            captionRowsCache.push(lastNewRow);
            captionRowsRenderCache.push({
              data: lastNewRow.data || lastNewRow.text,
              position: 'HB',
              alignment: 'C'
            });
            shouldUpdate = true;
          }
        } else {
          // No captions at current time, clear the roll-up
          if (captionRowsCache.length > 0) {
            captionRowsCache = [];
            captionRowsRenderCache = [];
            shouldUpdate = true;
          }
        }
        
        // Update the display rows
        captionRows = captionRowsCache.slice();
        captionRowsRender = captionRowsRenderCache.slice();
        
        if (shouldUpdate) {
          updateCaption();
        }
      } else {
        // For pop-on mode, just replace all captions
        captionRows = newRows;
        captionRowsRender = newRowsRender;
        updateCaption();
      }
    }

    // Set up time update handler
    player.on('timeupdate', function() {
      processCaptions(player.currentTime());
    });

    // API Methods
    player.caption = {
      updateCaption: function() {
        processCaptions(player.currentTime());
      },
      
      loadNewCaption: function(data) {
        captionData = data || [];
        captionRows = [];
        captionRowsRender = [];
        captionRowsCache = [];
        captionRowsRenderCache = [];
        rowCursorID = -1;
        player.pause();
        player.currentTime(0);
        processCaptions(0);
      },
      
      getRowCursorID: function() {
        return rowCursorID;
      },
      
      getCaptionData: function() {
        return captionData;
      },
      
      increaseFontSize: function() {
        if (captionSize < fontSizeTable.length - 1) {
          captionSize++;
          $(captionEl).css('font-size', fontSizeTable[captionSize]);
        }
      },
      
      decreaseFontSize: function() {
        if (captionSize > 0) {
          captionSize--;
          $(captionEl).css('font-size', fontSizeTable[captionSize]);
        }
      },
      
      changeToRollUp: function() {
        captionType = "roll-up";
        captionRows = [];
        captionRowsRender = [];
        captionRowsCache = [];
        captionRowsRenderCache = [];
        rowCursorID = -1;
        processCaptions(player.currentTime());
      },
      
      changeToPopOn: function() {
        captionType = "pop-on";
        captionRows = [];
        captionRowsRender = [];
        captionRowsCache = [];
        captionRowsRenderCache = [];
        rowCursorID = -1;
        processCaptions(player.currentTime());
      }
    };

    return player.caption;
  });
}));
