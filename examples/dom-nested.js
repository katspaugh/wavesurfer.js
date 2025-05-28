import createElement from '../src/dom.js'

const container = document.getElementById('nested')

createElement('div', {
  children: {
    text: document.createTextNode('Hello '),
    span: {
      children: {
        strong: { textContent: 'World' }
      }
    }
  }
}, container)

/*
<html>
  <div id="nested"></div>
</html>
*/
