# wavesurfer-js.org

## Update website

After a new release of wavesurfer.js is available on `npm`, the website needs to updated as well.

To update the website, first run:

```console
npm update
npm install
```

to update the website and make it use the latest wavesurfer.js.

Next, update the examples and API docs with this command:

```
npm run update
```

This command:

- generates the latest API docs
- injects the unpkg CDN url
- regenerates the examples index page
- syncs the `example` directory

Finally: don't forget to commit and push these changes in order to update the website.

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
