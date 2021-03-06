$(function() {
    var $window = $(window);
    var $userIdInput = $('.userIdInput');
    var $startStop = $('.startStop');
    var $messages = $('.messages');
    var socket = new io.connect($(location).attr('href'));

    function monitor() {
        var userId = $userIdInput.val().trim();
        if (userId.length > 0) {
            $messages.empty();
            socket.emit('start', userId);
            $userIdInput.blur();
            $startStop.val('Stop');
            $userIdInput.attr('disabled', 'disabled');
        }
    }

    function addLine(line) {
        var el = '<li class="entry">' +
                '<span class="time">' + line.brokerProperties.EnqueuedTimeUtc + '&nbsp;</span>' +
                '<span class="userId">' + line.customProperties.userid + '&nbsp;</span>' +
                '<span class="body">' + line.body + '</span></li>';
        $messages.append($(el));
    }

    $startStop.attr('disabled', 'disabled');

    $userIdInput.keyup(function (event) {
        var tmp = $userIdInput.val().trim();
        if (tmp.length > 0) {
            $startStop.removeAttr('disabled');
            if (event.which === 13) {
                monitor();
            }
        }
        else {
            $startStop.attr('disabled', 'disabled');
        }
    });

    $startStop.click(function (event) {
        if ($startStop.val() == 'Start') {
            monitor();
        }
        else {
            socket.emit('stop');
            $startStop.val('Start');
            $startStop.attr('disabled', 'disabled');
            $userIdInput.removeAttr('disabled');
            $userIdInput.val('');
        }
    });

    socket.on('connect', function() {
        $startStop.val('Start');
        $startStop.attr('disabled', 'disabled');
        $userIdInput.removeAttr('disabled');
        $userIdInput.val('');
    });

    socket.on('line', addLine);
});
