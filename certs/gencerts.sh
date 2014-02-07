PASSWORD="pass:blahblahblah"

cat << +EOF+ > .req.conf
[ req ]
distinguished_name     = req_distinguished_name
prompt                 = no

[ req_distinguished_name ]
C                      = US
ST                     = Massachusetts
L                      = Cambridge
O                      = Widgets, Inc.
OU                     = Manufacturing
CN                     = brhnotifierCA
emailAddress           = bradhowes@mac.com
+EOF+

#
# Generate self-signed CA
#
openssl req -config ./.req.conf -newkey rsa:1024 -keyout ca.key -nodes -out csr.pem
openssl x509 -req -days 9999 -in csr.pem -signkey ca.key -out ca.cert

cat << +EOF+ > .req.conf
[ req ]
distinguished_name     = req_distinguished_name
prompt                 = no

[ req_distinguished_name ]
C                      = US
ST                     = Massachusetts
L                      = Cambridge
O                      = Widgets, Inc.
OU                     = Manufacturing
CN                     = harrison.local
emailAddress           = bradhowes@mac.com
+EOF+

#
# Generate signed certs for server and a client.
#
for KIND in server client; do
    openssl req -config ./.req.conf -newkey rsa:1024 -keyout ${KIND}.key -nodes -out csr.pem
    openssl x509 -req -in csr.pem -out ${KIND}.cert -CA ca.cert -CAkey ca.key -CAcreateserial -days 365
done

rm -f ca.srl csr.pem .req.conf
