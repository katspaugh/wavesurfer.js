const iframe = document.querySelector('iframe')
const textarea = document.querySelector('textarea')

const loadPreview = (code) => {
  const html = code.replace(/\n/g, '').match(/<html>(.+?)<\/html>/gm) || []
  const script = code
    .replace(/<\/script>/g, '')
    .replace(/'wavesurfer.js'/g, `'../dist/wavesurfer.esm.js'`)
    .replace(/'wavesurfer.js/g, `'..`)
  const isBabel = script.includes('@babel')

  // Start of iframe template
  iframe.srcdoc = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>wavesurfer.js examples</title>
    <style>
      html {
        font-family: sans-serif;
      }
      body {
        margin: 0;
        padding: 1rem;
      }
      @media (prefers-color-scheme: dark) {
        body {
          background: #333;
          color: #eee;
        }
        a {
          color: #fff;
        }
      }
      input {
        vertical-align: middle;
      }
    </style>
  </head>

  <body>
    ${html.join('')}

    <script type="${isBabel ? 'text/babel' : 'module'}" data-type="module">
      ${script}
    </script>
  </body>
</html>
`
  // End of iframe template
}

const openExample = (url) => {
  fetch(`/examples/${url}`, {
    cache: 'no-cache',
  })
    .then((res) => res.text())
    .then((text) => {
      loadPreview(text)
      textarea.value = text
    })
}

let delay
document.querySelector('textarea').addEventListener('input', (e) => {
  if (delay) clearTimeout(delay)
  delay = setTimeout(() => {
    loadPreview(e.target.value)
  }, 500)
})

const url = location.hash.slice(1) || 'basic.js'
openExample(url)

let active = document.querySelector(`aside a[href="#${url}"]`)
if (active) active.classList.add('active')
document.querySelectorAll('aside a').forEach((link) => {
  link.addEventListener('click', () => {
    const url = link.hash.slice(1)
    openExample(url)
    if (active) active.classList.remove('active')
    active = link
    active.classList.add('active')
  })
})
