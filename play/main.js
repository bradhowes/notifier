(function ($) {
    $(function() {
        var applications;
        var templates;
        var registrations;
        var notifier;

        console.log('here 0');
        console.log('href:', $(location).attr('href'));

        function trimAndUpdate($obj) {
            var tmp = $obj.val().trim();
            $obj.val(tmp);
            return tmp;
        }

        function enable(button) {
            console.log(button);
            button.removeAttr('disabled');
        }

        function disable(button) {
            console.log(button);
            button.attr('disabled', 'disabled');
        }

        function clearLog($obj) {
            $obj.empty();
        }

        function addLog($obj, line) {
            var el = '<li class="entry">' + line + '</li>';
            $obj.append($(el));
        }

        function Applications() {
            var $top = $('#applications');
            var proc = this.validate.bind(this);

            this.$appId = $('#appId', $top);
            this.$service = $('#service', $top);

            this.$apns = $('#apns', $top);
            this.$gcm = $('#gcm', $top);
            this.$wns = $('#wns', $top);

            this.$apns.hide();
            this.$gcm.hide();
            this.$wns.hide();

            this.$doClear = $('#doClear', $top);
            this.$doQuery = $('#doQuery', $top);
            this.$doAdd = $('#doAdd', $top);
            this.$doDelete = $('#doDelete', $top);

            disable(this.$doQuery);
            disable(this.$doAdd);
            disable(this.$doDelete);

            this.$appId.keyup(proc);
            this.$service.change(this.doServiceChange.bind(this));

            this.$doClear.click(this.doClear.bind(this));
            this.$doQuery.click(this.doQuery.bind(this));
            this.$doAdd.click(this.doAdd.bind(this));
            this.$doDelete.click(this.doDelete.bind(this));
        }

        Applications.prototype = {

            doFileSelect: function(file, container) {
            },

            validate: function(event) {
            },

            doServiceChange: function() {
                var service = this.$service.val();
                if (service == 'APNS') {
                    this.$apns.show();
                    this.$gcm.hide();
                    this.$wns.hide();
                }
                else if (service == 'GCM') {
                    this.$apns.hide();
                    this.$gcm.show();
                    this.$wns.hide();
                }
                else if (service == 'WNS') {
                    this.$apns.hide();
                    this.$gcm.hide();
                    this.$wns.show();
                }
                else{
                    this.$apns.hide();
                    this.$gcm.hide();
                    this.$wns.hide();
                }
            },

            doClear: function() {
            },

            doQuery: function() {
            },

            doAdd: function() {
            },

            doDelete: function() {
            }
        };

        function Templates() {
            var $top = $('#templates');
            var proc = this.validate.bind(this);

            this.$eventId = $('#eventId', $top);
            this.$notificationId = $('#notificationId', $top);
            this.$templateVersion = $('#templateVersion', $top);
            this.$templateLanguage = $('#templateLanguage', $top);
            this.$route = $('#route', $top);
            this.$service = $('#service', $top);
            this.$content = $('#content', $top);
            this.$messages = $('#messages', $top);

            this.$doClear = $('#doClear', $top);
            this.$doQuery = $('#doQuery', $top);
            this.$doAdd = $('#doAdd', $top);
            this.$doDelete = $('#doDelete', $top);

            disable(this.$doQuery);
            disable(this.$doAdd);
            disable(this.$doDelete);

            this.$eventId.keyup(proc);
            this.$notificationId.keyup(proc);
            this.$templateVersion.keyup(proc);
            this.$templateLanguage.keyup(proc);
            this.$route.keyup(proc);
            this.$service.change(proc);
            this.$content.keyup(proc);

            this.$doClear.click(this.doClear.bind(this));
            this.$doQuery.click(this.doQuery.bind(this));
            this.$doAdd.click(this.doAdd.bind(this));
            this.$doDelete.click(this.doDelete.bind(this));
        }

        Templates.prototype = {

            validate: function(event) {
                var eventId = trimAndUpdate(this.$eventId);
                var notificationId = trimAndUpdate(this.$notificationId);
                var templateVersion = trimAndUpdate(this.$templateVersion);
                var templateLanguage = trimAndUpdate(this.$templateLanguage);
                var route = trimAndUpdate(this.$route);
                var service = this.$service.val();
                var content = this.$content.val().trim();

                if (eventId.length > 0) {
                    enable(this.$doQuery);
                }
                else {
                    disable(this.$doQuery);
                }

                if (eventId.length > 0 && notificationId.length > 0 &&
                    templateVersion.length > 0 && templateLanguage.length > 0 && route.length > 0 &&
                    service.length > 0 && content.length > 0) {
                    enable(this.$doAdd);
                }
                else {
                    disable(this.$doAdd);
                }
            },

            doClear: function() {
                // This could be simpler with a jQuery selector...
                //
                this.$eventId.val('');
                this.$notificationId.val('');
                this.$templateVersion.val('');
                this.$templateLanguage.val('');
                this.$route.val('');
                this.$service.val('');
                this.$content.val('');

                clearLog(this.$messages);

                disable(this.$doAdd);
                disable(this.$doQuery);
            },

            doQuery: function() {
                var self = this;
                var url = '/templates?eventId=' + this.$eventId.val();
                console.log('url:', url);
                clearLog(this.$messages);
                $.ajax({
                    type: 'GET',
                    url: url,
                    contentType: 'application/json',
                    success: function(data, textStatus, jqXHR) {
                        console.log('response:', data);
                        console.log('textStatus:', textStatus);
                        addLog(self.$messages, '<pre>' + JSON.stringify(data, null, ' ') + '</pre>');
                    },
                    error: function(data, textStatus, jqXHR) {
                        console.log('failed:', data);
                        addLog(self.$messages, 'Failed: ' + data.responseText);
                    }
                });
            },

            doAdd: function() {
                var self = this;
                var url = '/templates';
                var data = {
                    eventId: this.$eventId.val().trim(),
                    notificationId: this.$notificationId.val().trim(),
                    templateVersion: this.$templateVersion.val().trim(),
                    templateLanguage: this.$templateLanguage.val().trim(),
                    service: this.$service.val().trim(),
                    route: this.$route.val().trim(),
                    template: {content: this.$content.val()}};

                console.log('url:', url);
                data = JSON.stringify(data);
                console.log('data:', data);

                clearLog(this.$messages);
                $.ajax({
                    type: 'POST',
                    url: url,
                    contentType: 'application/json',
                    data: data,
                    dataType: 'json',
                    success: function(data, textStatus, jqXHR) {
                        console.log('response:', data);
                        console.log('textStatus:', textStatus);
                        addLog(self.$messages, 'Registered template');
                    },
                    error: function(data, textStatus, jqXHR) {
                        console.log('failed:', textStatus);
                        addLog(self.$messages, 'Failed - ' + textStatus);
                    }
                });
            },

            doDelete: function() {
            }
        };

        function Registrations() {
            var $top = $('#registrations');
            this.$userId = $('#userId', $top);
            this.$deviceId = $('#deviceId', $top);
            this.$templateVersion = $('#templateVersion', $top);
            this.$templateLanguage = $('#templateLanguage', $top);
            this.$route = $('#route', $top);
            this.$service = $('#service', $top);
            this.$token = $('#token', $top);
            this.$messages = $('#messages', $top);

            this.$doClear = $('#doClear', $top);
            this.$doQuery = $('#doQuery', $top);
            this.$doAdd = $('#doAdd', $top);

            disable(this.$doQuery);
            disable(this.$doAdd);

            var proc = this.validate.bind(this);
            this.$userId.keyup(proc);
            this.$deviceId.keyup(proc);
            this.$templateVersion.keyup(proc);
            this.$templateLanguage.keyup(proc);
            this.$route.keyup(proc);
            this.$service.change(proc);
            this.$token.keyup(proc);

            this.$doClear.click(this.doClear.bind(this));
            this.$doQuery.click(this.doQuery.bind(this));
            this.$doAdd.click(this.doAdd.bind(this));
        }

        Registrations.prototype = {

            validate: function(event) {
                var userId = trimAndUpdate(this.$userId);
                var deviceId = trimAndUpdate(this.$deviceId);
                var templateVersion = trimAndUpdate(this.$templateVersion);
                var templateLanguage = trimAndUpdate(this.$templateLanguage);
                var route = trimAndUpdate(this.$route);
                var service = this.$service.val();
                var token = trimAndUpdate(this.$token);
                if (userId.length > 0) {
                    enable(this.$doQuery);
                }
                else {
                    disable(this.$doQuery);
                }

                if (userId.length > 0 && deviceId.length > 0 && templateVersion.length > 0 &&
                    templateLanguage.length > 0 && route.length > 0 && service.length > 0 && token.length > 0) {
                    enable(this.$doAdd);
                }
                else {
                    disable(this.$doAdd);
                }
            },

            doClear: function() {
                this.$userId.val('');
                this.$deviceId.val('');
                this.$templateVersion.val('');
                this.$templateLanguage.val('');
                this.$route.val('');
                this.$service.val('');
                this.$token.val('');

                clearLog(this.$messages);

                disable(this.$doQuery);
                disable(this.$doAdd);
            },

            doQuery: function() {
                var self = this;
                var url = '/registrations/' + this.$userId.val();
                console.log('url:', url);
                clearLog(this.$messages);
                $.ajax({
                    type: 'GET',
                    url: url,
                    contentType: 'application/json',
                    success: function(data, textStatus, jqXHR) {
                        console.log('response:', data);
                        console.log('textStatus:', textStatus);
                        addLog(self.$messages, '<pre>' + JSON.stringify(data, null, ' ') + '</pre>');
                    },
                    error: function(data, textStatus, jqXHR) {
                        console.log('failed:', data);
                        addLog(self.$messages, 'Failed: ' + data.responseText);
                    }
                });
            },

            doAdd: function() {
                var self = this;
                var url = '/post/' + this.$userId.val();
                var data = {eventId: this.$eventId.val(), substitutions:{}};
                console.log('url:', url);
                if (this.$params.val().length > 0) data.substitutions = JSON.parse(this.$params.val());
                data = JSON.stringify(data);
                console.log('data:', data);
                clearLog(this.$messages);
                $.ajax({
                    type: 'POST',
                    url: url,
                    contentType: 'application/json',
                    data: data,
                    dataType: 'json',
                    success: function(data, textStatus, jqXHR) {
                        console.log('response:', data);
                        console.log('textStatus:', textStatus);
                        addLog(self.$messages, 'Sending ' + data.count + ' notifications');
                    },
                    error: function(data, textStatus, jqXHR) {
                        console.log('failed:', textStatus);
                        addLog(self.$messages, 'Failed - ' + textStatus);
                    }
                });
            }
        };

        function Notifier() {
            var $top = $('#notifier');
            this.$userId = $('#userId', $top);
            this.$eventId = $('#eventId', $top);
            this.$params = $('#params', $top);
            this.$messages = $('#messages', $top);

            this.$doPost = $('#doPost', $top);
            this.$doClear = $('#doClear', $top);

            disable(this.$doPost);

            var proc = this.validate.bind(this);
            this.$userId.keyup(proc);
            this.$eventId.keyup(proc);
            this.$params.keyup(proc);

            this.$doPost.click(this.doPost.bind(this));
            this.$doClear.click(this.doClear.bind(this));
        }

        Notifier.prototype = {

            validate: function(event) {
                var userId = trimAndUpdate(this.$userId);
                var eventId = this.$eventId.val().trim();
                var params = this.$params.val().trim();
                var validParams = true;

                this.$userId.val(userId);
                this.$eventId.val(eventId);

                if (params.length > 0) {
                    try {
                        JSON.parse(params);
                    } catch (ex) {
                        validParams = false;
                    }

                    if (validParams) {
                        this.$params.css('color', 'black');
                    }
                    else {
                        this.$params.css('color', 'red');
                    }
                }
                if (userId.length > 0 && eventId.length > 0 && validParams) {
                    enable(this.$doPost);
                }
                else {
                    disable(this.$doPost);
                }
            },

            doClear: function() {
                this.$userId.val('');
                this.$eventId.val('');
                this.$params.val('');
                clearLog(this.$messages);
                disable(this.$doPost);
            },

            doPost: function() {
                var self = this;
                var url = '/post/' + this.$userId.val();
                var data = {eventId: this.$eventId.val(), substitutions:{}};
                console.log('url:', url);
                if (this.$params.val().length > 0) data.substitutions = JSON.parse(this.$params.val());
                data = JSON.stringify(data);
                console.log('data:', data);
                clearLog(this.$messages);
                $.ajax({
                    type: 'POST',
                    url: url,
                    contentType: 'application/json',
                    data: data,
                    dataType: 'json',
                    success: function(data, textStatus, jqXHR) {
                        console.log('response:', data);
                        console.log('textStatus:', textStatus);
                        addLog(self.$messages, 'Sending ' + data.count + ' notifications');
                    },
                    error: function(data, textStatus, jqXHR) {
                        console.log('failed:', textStatus);
                        addLog(self.$messages, 'Failed - ' + textStatus);
                    }
                });
            }
        };

        applications = new Applications();
        templates = new Templates();
        registrations = new Registrations();
        notifier = new Notifier();

        $("#tabs").tabs({activate: clearLog});
    });
})(jQuery);
