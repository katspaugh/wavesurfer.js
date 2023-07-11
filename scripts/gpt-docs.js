import fs from 'fs'
import { config } from 'dotenv'

config()

const TS_CODE = fs.readFileSync('./dist/wavesurfer.d.ts', 'utf-8')

fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  },
  body: JSON.stringify({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'user',
        content:
          `
Format the given TypeScript types as Markdown. The output should be in the following format:

## API reference

### Wavesurfer options
... (every single option in backticks, its type, and the comment above it)

### Wavesurfer events
... (every single event and its type, ordered semantically, with a comment above each one)

Typescript types:
` + TS_CODE,
      },
    ],
  }),
})
  .then((response) => response.json())
  .then((data) => {
    const MD_CONTENT = data.choices[0].message.content
    console.log(MD_CONTENT)
  })
  .catch((error) => console.error(error))
