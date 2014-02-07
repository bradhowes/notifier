See https://gist.github.com/sandfox/1831932

###
#Step 1 - Generate server certificates etc... (most of this code is horribly ripped off from nodejs docs currently -> http://nodejs.org/docs/latest/api/tls.html)
###
 
#Assuming your starting from a clean directory

mkdir server
cd server

#generate private key
openssl genrsa -out server-private-key.pem 4096

#generate signing request
openssl req -new -key server-private-key.pem -out server-certificate-signing-request.pem

#self sign the request (or send off the Verisign etc etc)
openssl x509 -req -in server-certificate-signing-request.pem -signkey server-private-key.pem -out server-certificate.pem

###
#Step 2 - now for the client certificates
###
cd ../
mkdir client
cd client
 
#generate private key
openssl genrsa -out client-private-key.pem 4096

#generate signing request
openssl req -new -key client-private-key.pem -out client-certificate-signing-request.pem

#self sign the request (or send off the Verisign etc etc)
openssl x509 -req -in client-certificate-signing-request.pem -signkey client-private-key.pem -out client-certificate.pem

###
# Step 3 - create some code (copy + pasta)
###
 
# Copy the server.js file to the server folder, and the client.js file to client folder
# Make sure you have 2 terminal windows open
# Goto the server folder in terminal window 1
sudo node server.js
# Goto the client folder in terminal window 2
node client.js
# See output in terminal window 1
# Profit (or better yet improve this code so it's actually more useful
