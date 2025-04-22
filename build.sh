#!/bin/bash

# Kill any running npm dev processes
pkill -f 'npm run dev'

# Remove the existing build log if it exists
rm -f build.log

# Start the npm dev process and log output to build.log while displaying it in the console
npm run dev | tee build.log &

# Change the ownership of the build.log file
#sudo chown -R half ./build.log

# Continuously watch the build.log file
#watch ./build.log
