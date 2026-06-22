@echo off
set JAVA_HOME=C:\tmp\jdk17\jdk-17.0.19+10
set PATH=%JAVA_HOME%\bin;%PATH%
..\NewPipeExtractor\gradlew.bat -p . run
