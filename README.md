# wavesurfer-js.org

## Update website

After a new release of wavesurfer.js is available on `npm`, the website needs to updated as well.

To update the library dependencies (inc. wavesurfer.js), first run:

```console
npm update
npm install
```
This makes sure the website uses the latest version of the wavesurfer.js library.

Next, update the website content with this command:

```console
npm run update
```

This command:

- generates the latest API docs
- copies and syncs the files in the `example` directory
- injects the unpkg CDN url
- regenerates the examples index page

Finally: don't forget to commit and push these changes in order to update the website.

## How to launch locally

Install Jekyll:

```console
gem install jekyll
```

Build & launch a dev server:

```console
jekyll serve
```

Go to http://127.0.0.1:4000/

Update generated documentation and commit automatically (Note: make sure no changes are staged before running the script):

```console
# Make sure the script is executable
chmod +x update-docs.sh

# Update documentation
./update-docs.sh
```
