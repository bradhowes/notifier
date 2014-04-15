#!/bin/bash
set -x 
SERVER="localhost:4465"
#SERVER="notifier.bradhowes.c9.io"

function usage
{
    cat << +EOF+
usage: gettemp EVTID [NOTID TVERS TLANG SVC ROUTE]

EVTID: Skype event ID to query for [eventId]
NOTID: notification ID for the template [notificationId]
TVERS: template version of the template [templateVersion]
TLANG: template langugage of the template [templateLanguage]
SVC: service of the template ("wns", "apns", "mpns") [service]
ROUTE: route name of the template [route]

+EOF+
    exit 1
}

if (( $# != 1  && $# != 6 )); then
    usage
fi

if (( $# == 1 )); then
    curl -w "\nTime: %{time_total}s Response: %{http_code} Content-Type: %{content_type}" \
        -X GET \
        -H 'Content-Type: application/json' "http://${SERVER}/templates?eventId=${1}"
else
    curl -w "\nTime: %{time_total}s Response: %{http_code} Content-Type: %{content_type}" \
        -X GET \
        -H 'Content-Type: application/json' "http://${SERVER}/templates?eventId=${1}&notificationId=${2}&templateVersion=${3}&templateLanguage=${4}&service=${5}&route=${6}"
fi

echo
