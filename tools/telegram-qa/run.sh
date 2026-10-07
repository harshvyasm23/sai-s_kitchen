#!/bin/sh
# Runs the entry-logic QA on a plain JVM (needs kotlinc). Usage: tools/telegram-qa/run.sh
A=android/app/src/main/java/me/saiskitchen/app
kotlinc $A/Models.kt $A/Format.kt $A/WhatsAppParser.kt $A/EntryPlanner.kt $A/NameStd.kt tools/telegram-qa/Test.kt -include-runtime -d /tmp/qa.jar && java -jar /tmp/qa.jar
