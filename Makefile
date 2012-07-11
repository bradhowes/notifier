
all: tests doc

doc: README.html doc/*.html

# NOTE: the following relies on jsdoc-toolkit (http://code.google.com/p/jsdoc-toolkit).
doc/*.html: APNs.js WNS.js config.js notifier.js payloadGenerator.js registrar.js registrationStore.js server.js \
	templateManager.js templateStore.js Makefile
	if [ -n "${JSDOCDIR}" ]; then \
		java -Djsdoc.dir=${JSDOCDIR} -jar ${JSDOCDIR}/jsrun.jar ${JSDOCDIR}/app/run.js -d=./doc \
			-t=${JSDOCDIR}/templates/jsdoc -a $^; \
    fi

clean:
	rm -f README.html

tests:
	vows test/*.js

%.html : %.md
	markdown_py $< > $@
