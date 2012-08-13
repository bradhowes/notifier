
all: tests doc placeholderParser.js

templateParser.js: templateParser.pegjs
	node_modules/pegjs/bin/pegjs $^ $@

doc: README.html doc/*.html

# NOTE: the following relies on jsdoc-toolkit (http://code.google.com/p/jsdoc-toolkit).
doc/*.html: APNs.js GCM.js WNS.js config.js deque.js filter.js loggerUtils.js notifier.js payloadGenerator.js \
	postTracker.js registrar.js registrationStore.js server.js templateManager.js templateStore.js \
	userDeviceTracker.js
	/usr/local/lib/node_modules/noc/bin/noc -d=doc -t=/usr/local/lib/node_modules/noc/templates/codeview $^

clean:
	rm -f README.html

tests:
	vows test/*.js

%.html : %.md
	markdown_py $< > $@
