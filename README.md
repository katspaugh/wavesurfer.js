# wavesurfer-js.org

## Update examples

After a new release, run:

```
npm update
npm install
```

to update to latest wavesurfer.js.

Now update the examples and API docs with:

```
npm run update
```

This will generate the API docs, inject the CDN url, regenerate the examples index page, and sync the `example` directory.

Don't forget to commit and push these changes in order to update the website.

## How to launch locally

Install Jekyll:

```
gem install jekyll
```

Build & launch a dev server:

```
jekyll serve
```

Go to http://127.0.0.1:4000/

Update generated documentation and commit automatically (Note: make sure no changes are staged before running the script):

```
# Make sure the script is executable
chmod +x update-docs.sh

# Update documentation
./update-docs.sh
```
