# wavesurfer-js.org

This branch contains the content of the website at https://wavesurfer-js.org.

## Update website

**After** a new release of wavesurfer.js is available on `npm`, the website needs to be updated as well.

Make sure you're on the `gh-pages` branch of the repository:


```console
git checkout gh-pages
```

And update the wavesurfer.js:

```console
npm install wavesurfer.js@latest
```

Next, update the website content with this command:

```console
npm run update
```

This command:

- downloads and unzips the latest wavesurfer.js release to a temporary directory
- generates the latest API docs
- copies and syncs the files in this repository
- injects the unpkg CDN url in the `example` directory
- regenerates the `example` index page

Finally: don't forget to commit and push these changes in order to update the website.

```console
git commit -am "update for wavesurfer.js x.x.x"
git push
```

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
