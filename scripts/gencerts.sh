PASSWORD="pass:Th1sIsAT3st"

cat << +EOF+ > .req.conf
[ req ]
distinguished_name     = req_distinguished_name
prompt                 = no

[ req_distinguished_name ]
C                      = US
ST                     = New York
L                      = New York
O                      = Widgets, Inc.
OU                     = Manufacturing
CN                     = johndoe
emailAddress           = johndoe@example.com
+EOF+

#
# Generate self-signed CA
#
openssl req -config ./.req.conf -newkey rsa:1024 -keyout ca.key -passout "${PASSWORD}" -out csr.pem
openssl x509 -req -days 9999 -in csr.pem -signkey ca.key -passin "${PASSWORD}" -out ca.cert

#
# Generate signed certs for server and a client.
#
for KIND in server client; do
    openssl req -config ./.req.conf -newkey rsa:1024 -keyout ${KIND}.key -passout "${PASSWORD}" -out csr.pem
    openssl x509 -req -in csr.pem -out ${KIND}.cert -CA ca.cert -CAkey ca.key -CAcreateserial -days 365 \
        -passin "${PASSWORD}"
done

rm -f ca.srl csr.pem .req.conf
