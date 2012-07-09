#!/bin/bash

function usage
{
    cat << +EOF+
usage: addreg USER REGID TVERS TLANG SVC NAME TOKEN TTL [NAME TOKEN TTL]...

USER: user ID to register under
REGID: unique registration ID to add/update [registrationId]
TVERS: template version to register for [templateVersion]
TLANG: template langugage to register for [templateLanguage]
SVC: notification service to use ("wns", "apns", "mpns") [service]
NAME: route name to register [name]
TOKEN: service-specific route notification token to register [token]
TTL: route lifetime in seconds [secondsToLive]
+EOF+
    exit 1
}

if (( $# < 8 )); then
    usage
fi

userId="${1}"
json="{\"registrationId\":\"${2}\",\"templateVersion\":\"${3}\",\"templateLanguage\":\"${4}\",\"service\":\"${5}\","
json="${json}\"routes\":["
shift 5
comma=""
while (( $# > 0 ))
do
    if (( $# < 3 )); then
        usage
    fi
    json="${json}${comma}{\"name\":\"${1}\",\"token\":\"${2}\",\"secondsToLive\":${3}}"
    comma=","
    shift 3
done

json="${json}]}"

curl -H 'Content-Type: application/json' -d "${json}" http://notifier.bradhowes.c9.io/registrations/${userId}

echo
