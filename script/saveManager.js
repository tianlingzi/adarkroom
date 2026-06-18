/**
 * Save Manager Module
 * 实现多存档轮询保存机制
 * 每5分钟自动保存，共10个存档位置，循环覆盖
 */
var SaveManager = {
    SLOT_COUNT: 10,
    AUTO_SAVE_INTERVAL: 5 * 60 * 1000,
    STORAGE_PREFIX: 'adarkroom_slot_',
    CURRENT_SLOT_KEY: 'adarkroom_current_slot',
    AUTO_SAVE_ENABLED_KEY: 'adarkroom_auto_save_enabled',
    
    currentSlot: 0,
    autoSaveTimer: null,
    autoSaveEnabled: true,
    panel: null,
    
    init: function() {
        var savedSlot = localStorage.getItem(this.CURRENT_SLOT_KEY);
        if (savedSlot !== null) {
            this.currentSlot = parseInt(savedSlot, 10);
        }
        
        var autoSaveSetting = localStorage.getItem(this.AUTO_SAVE_ENABLED_KEY);
        if (autoSaveSetting !== null) {
            this.autoSaveEnabled = autoSaveSetting === 'true';
        }
        
        if (this.autoSaveEnabled) {
            this.startAutoSave();
        }
        
        Engine.log('SaveManager initialized. Current slot: ' + this.currentSlot);
    },
    
    startAutoSave: function() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
        
        this.autoSaveTimer = setInterval(() => {
            this.autoSave();
        }, this.AUTO_SAVE_INTERVAL);
        
        this.autoSaveEnabled = true;
        localStorage.setItem(this.AUTO_SAVE_ENABLED_KEY, 'true');
        Engine.log('Auto-save started');
    },
    
    stopAutoSave: function() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
        this.autoSaveEnabled = false;
        localStorage.setItem(this.AUTO_SAVE_ENABLED_KEY, 'false');
        Engine.log('Auto-save stopped');
    },
    
    toggleAutoSave: function() {
        if (this.autoSaveEnabled) {
            this.stopAutoSave();
        } else {
            this.startAutoSave();
        }
        return this.autoSaveEnabled;
    },
    
    autoSave: function() {
        var slotIndex = this.currentSlot;
        this.saveToSlot(slotIndex);
        
        this.currentSlot = (this.currentSlot + 1) % this.SLOT_COUNT;
        localStorage.setItem(this.CURRENT_SLOT_KEY, this.currentSlot.toString());
        
        Notifications.notify(null, _('game auto-saved to slot {0}', slotIndex + 1));
        Engine.log('Auto-saved to slot ' + (slotIndex + 1));
    },
    
    saveToSlot: function(slotIndex) {
        if (slotIndex < 0 || slotIndex >= this.SLOT_COUNT) {
            return false;
        }
        
        try {
            Engine.saveGame();
            var gameData = localStorage.gameState;
            if (!gameData) {
                return false;
            }
            
            var saveData = {
                data: gameData,
                timestamp: Date.now(),
                version: Engine.VERSION
            };
            
            var key = this.STORAGE_PREFIX + slotIndex;
            localStorage.setItem(key, JSON.stringify(saveData));
            
            Engine.log('Saved to slot ' + (slotIndex + 1));
            return true;
        } catch (e) {
            Engine.log('Failed to save: ' + e.message);
            return false;
        }
    },
    
    loadFromSlot: function(slotIndex) {
        if (slotIndex < 0 || slotIndex >= this.SLOT_COUNT) {
            return false;
        }
        
        try {
            var key = this.STORAGE_PREFIX + slotIndex;
            var saveDataStr = localStorage.getItem(key);
            
            if (!saveDataStr) {
                return false;
            }
            
            var saveData = JSON.parse(saveDataStr);
            localStorage.gameState = saveData.data;
            
            Engine.log('Loaded from slot ' + (slotIndex + 1));
            location.reload();
            return true;
        } catch (e) {
            Engine.log('Failed to load: ' + e.message);
            return false;
        }
    },
    
    deleteSlot: function(slotIndex) {
        if (slotIndex < 0 || slotIndex >= this.SLOT_COUNT) {
            return false;
        }
        
        try {
            var key = this.STORAGE_PREFIX + slotIndex;
            localStorage.removeItem(key);
            Engine.log('Deleted slot ' + (slotIndex + 1));
            return true;
        } catch (e) {
            return false;
        }
    },
    
    getSlotInfo: function(slotIndex) {
        if (slotIndex < 0 || slotIndex >= this.SLOT_COUNT) {
            return null;
        }
        
        try {
            var key = this.STORAGE_PREFIX + slotIndex;
            var saveDataStr = localStorage.getItem(key);
            
            if (!saveDataStr) {
                return null;
            }
            
            var saveData = JSON.parse(saveDataStr);
            var date = new Date(saveData.timestamp);
            
            return {
                index: slotIndex,
                timestamp: saveData.timestamp,
                dateStr: this.formatDate(date),
                timeStr: this.formatTime(date),
                version: saveData.version,
                exists: true
            };
        } catch (e) {
            return null;
        }
    },
    
    getAllSlots: function() {
        var slots = [];
        for (var i = 0; i < this.SLOT_COUNT; i++) {
            var info = this.getSlotInfo(i);
            slots.push(info || {
                index: i,
                exists: false
            });
        }
        return slots;
    },
    
    exportSlot: function(slotIndex) {
        if (slotIndex < 0 || slotIndex >= this.SLOT_COUNT) {
            return null;
        }
        
        try {
            var key = this.STORAGE_PREFIX + slotIndex;
            var saveDataStr = localStorage.getItem(key);
            
            if (!saveDataStr) {
                return null;
            }
            
            var encoded = Base64.encode(saveDataStr);
            return encoded.replace(/\s/g, '');
        } catch (e) {
            return null;
        }
    },
    
    importToSlot: function(slotIndex, encodedData) {
        if (slotIndex < 0 || slotIndex >= this.SLOT_COUNT) {
            return false;
        }
        
        try {
            encodedData = encodedData.replace(/\s/g, '');
            var saveDataStr = Base64.decode(encodedData);
            var saveData = JSON.parse(saveDataStr);
            
            if (!saveData.data || !saveData.timestamp) {
                return false;
            }
            
            var key = this.STORAGE_PREFIX + slotIndex;
            localStorage.setItem(key, saveDataStr);
            
            Engine.log('Imported to slot ' + (slotIndex + 1));
            return true;
        } catch (e) {
            return false;
        }
    },
    
    formatDate: function(date) {
        var year = date.getFullYear();
        var month = ('0' + (date.getMonth() + 1)).slice(-2);
        var day = ('0' + date.getDate()).slice(-2);
        return year + '-' + month + '-' + day;
    },
    
    formatTime: function(date) {
        var hours = ('0' + date.getHours()).slice(-2);
        var minutes = ('0' + date.getMinutes()).slice(-2);
        return hours + ':' + minutes;
    },
    
    openSaveManager: function() {
        this.closePanel();
        
        Engine.keyLock = true;
        Engine.enableSelection();
        
        this.panel = $('<div>').attr('id', 'saveManagerPanel').addClass('eventPanel').css({
            opacity: 0,
            width: '550px'
        });
        
        $('<div>').addClass('eventTitle').text(_('Save Manager')).appendTo(this.panel);
        
        var content = $('<div>').attr('id', 'saveManagerContent').appendTo(this.panel);
        
        $('<div>').addClass('saveManagerInfo').text(
            _('manage your game saves. auto-save every 5 minutes.')
        ).appendTo(content);
        
        $('<div>').addClass('saveManagerInfo').text(
            _('current auto-save: {0}', this.autoSaveEnabled ? _('on') : _('off'))
        ).appendTo(content);
        
        var btnContainer = $('<div>').addClass('saveManagerButtons').appendTo(content);
        
        $('<button>').addClass('smBtn')
            .text(this.autoSaveEnabled ? _('disable auto-save') : _('enable auto-save'))
            .click(() => {
                this.toggleAutoSave();
                this.openSaveManager();
            }).appendTo(btnContainer);
        
        $('<button>').addClass('smBtn')
            .text(_('close'))
            .click(() => this.closePanel())
            .appendTo(btnContainer);
        
        $('<div>').addClass('saveManagerSectionTitle').text(_('select a slot to manage:')).appendTo(content);
        
        var slotsContainer = $('<div>').addClass('saveManagerSlots').appendTo(content);
        
        var slots = this.getAllSlots();
        slots.forEach(slot => {
            var slotDiv = $('<div>').addClass('saveManagerSlot').appendTo(slotsContainer);
            
            $('<div>').addClass('saveManagerSlotHeader').text(
                _('slot {0}', slot.index + 1)
            ).appendTo(slotDiv);
            
            if (slot.exists) {
                $('<div>').addClass('saveManagerSlotInfo').text(
                    _('saved: {0} {1}', slot.dateStr, slot.timeStr)
                ).appendTo(slotDiv);
                $('<div>').addClass('saveManagerSlotInfo').text(
                    _('version: {0}', slot.version)
                ).appendTo(slotDiv);
            } else {
                $('<div>').addClass('saveManagerSlotInfo').text(_('empty')).appendTo(slotDiv);
            }
            
            var slotButtons = $('<div>').addClass('saveManagerSlotButtons').appendTo(slotDiv);
            
            $('<button>').addClass('smSlotBtn')
                .text(_('save here'))
                .click(() => {
                    this.saveToSlot(slot.index);
                    Notifications.notify(null, _('saved to slot {0}', slot.index + 1));
                    this.openSaveManager();
                }).appendTo(slotButtons);
            
            $('<button>').addClass('smSlotBtn')
                .text(_('load'))
                .attr('disabled', !slot.exists)
                .click(() => {
                    this.loadFromSlot(slot.index);
                }).appendTo(slotButtons);
            
            $('<button>').addClass('smSlotBtn')
                .text(_('export'))
                .attr('disabled', !slot.exists)
                .click(() => {
                    this.showExportDialog(slot);
                }).appendTo(slotButtons);
            
            $('<button>').addClass('smSlotBtn')
                .text(_('import'))
                .click(() => {
                    this.showImportDialog(slot);
                }).appendTo(slotButtons);
            
            $('<button>').addClass('smSlotBtn smSlotBtnDelete')
                .text(_('delete'))
                .attr('disabled', !slot.exists)
                .click(() => {
                    if (confirm(_('are you sure you want to delete this save?'))) {
                        this.deleteSlot(slot.index);
                        Notifications.notify(null, _('slot {0} deleted', slot.index + 1));
                        this.openSaveManager();
                    }
                }).appendTo(slotButtons);
        });
        
        $('div#wrapper').append(this.panel);
        this.panel.animate({opacity: 1}, 200, 'linear');
    },
    
    showExportDialog: function(slot) {
        this.closePanel();
        
        Engine.keyLock = true;
        
        this.panel = $('<div>').attr('id', 'saveManagerPanel').addClass('eventPanel').css({
            opacity: 0,
            width: '500px'
        });
        
        $('<div>').addClass('eventTitle').text(_('export slot {0}', slot.index + 1)).appendTo(this.panel);
        
        var content = $('<div>').attr('id', 'saveManagerContent').appendTo(this.panel);
        
        $('<div>').addClass('saveManagerInfo').text(_('copy this save code:')).appendTo(content);
        
        var code = this.exportSlot(slot.index) || '';
        var textarea = $('<textarea>').addClass('saveManagerTextarea')
            .val(code)
            .attr('readonly', true)
            .appendTo(content);
        
        textarea.select();
        
        var btnContainer = $('<div>').addClass('saveManagerButtons').appendTo(content);
        
        $('<button>').addClass('smBtn')
            .text(_('copy to clipboard'))
            .click(() => {
                textarea.select();
                document.execCommand('copy');
                Notifications.notify(null, _('copied to clipboard'));
            }).appendTo(btnContainer);
        
        $('<button>').addClass('smBtn')
            .text(_('back'))
            .click(() => this.openSaveManager())
            .appendTo(btnContainer);
        
        $('div#wrapper').append(this.panel);
        this.panel.animate({opacity: 1}, 200, 'linear');
    },
    
    showImportDialog: function(slot) {
        this.closePanel();
        
        Engine.keyLock = true;
        
        this.panel = $('<div>').attr('id', 'saveManagerPanel').addClass('eventPanel').css({
            opacity: 0,
            width: '500px'
        });
        
        $('<div>').addClass('eventTitle').text(_('import to slot {0}', slot.index + 1)).appendTo(this.panel);
        
        var content = $('<div>').attr('id', 'saveManagerContent').appendTo(this.panel);
        
        $('<div>').addClass('saveManagerInfo').text(_('paste save code here:')).appendTo(content);
        
        var textarea = $('<textarea>').addClass('saveManagerTextarea').appendTo(content);
        
        var btnContainer = $('<div>').addClass('saveManagerButtons').appendTo(content);
        
        $('<button>').addClass('smBtn')
            .text(_('import'))
            .click(() => {
                var code = textarea.val();
                if (code && this.importToSlot(slot.index, code)) {
                    Notifications.notify(null, _('imported to slot {0}', slot.index + 1));
                    this.openSaveManager();
                } else {
                    Notifications.notify(null, _('import failed'));
                }
            }).appendTo(btnContainer);
        
        $('<button>').addClass('smBtn')
            .text(_('cancel'))
            .click(() => this.openSaveManager())
            .appendTo(btnContainer);
        
        $('div#wrapper').append(this.panel);
        this.panel.animate({opacity: 1}, 200, 'linear');
    },
    
    closePanel: function() {
        if (this.panel) {
            this.panel.animate({opacity: 0}, 200, 'linear', function() {
                $(this).remove();
            });
            this.panel = null;
            Engine.keyLock = false;
            Engine.disableSelection();
        }
    }
};