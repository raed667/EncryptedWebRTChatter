#!/bin/bash
set -e

PAGES_DIR=./gh-pages
REPO="https://github.com/RaedsLab/EncryptedWebRTChatter.git"

echo "Publishing"

# get the gh-pages branch of the repo
if [ ! -d $PAGES_DIR ] ; then
  git clone --single-branch --branch gh-pages $REPO $PAGES_DIR
fi

cp *.svg *.png *.css dist/*.js $PAGES_DIR

cp $PAGES_DIR/index.html $PAGES_DIR/404.html

pushd $PAGES_DIR
git add .
git commit -a -m "Docs update"
if [ $? -eq 1 ] ; then
  echo "Nothing to update"
else
  git push origin gh-pages
fi
popd
