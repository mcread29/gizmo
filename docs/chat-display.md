# Formatted chat output

Gizmo includes a `display` tool for rendering json-render content directly in
chat. No registry extension is required. The tool uses Gizmo's pinned
`@json-render/svelte` renderer and a fixed component catalog.

Without `input`, the tool displays its content and completes immediately. With
`input`, it publishes the content first, then waits for an answer through Gizmo's
existing question UI. The answer returns to the agent as the tool result.

## Example

```json
{
	"title": "Build summary",
	"spec": {
		"root": "summary",
		"elements": {
			"summary": {
				"type": "Card",
				"props": { "title": "Verification" },
				"children": ["tests", "notes"]
			},
			"tests": {
				"type": "Metric",
				"props": { "label": "Tests passed", "value": "213" }
			},
			"notes": {
				"type": "Text",
				"props": { "text": "The application is ready for review." }
			}
		}
	},
	"input": {
		"kind": "select",
		"prompt": "What should I do next?",
		"options": ["Review changes", "Run more tests"]
	}
}
```

Omit `input` for output that does not need a reply.

## Component catalog

| Type      | Props                                                             | Children |
| --------- | ----------------------------------------------------------------- | -------- |
| `Heading` | `text`, optional `level` of 1, 2, or 3                            | No       |
| `Text`    | `text`                                                            | No       |
| `Card`    | Optional `title`                                                  | Yes      |
| `Stack`   | `{}`                                                              | Yes      |
| `List`    | `items`, an array of strings                                      | No       |
| `Table`   | `columns`, an array of strings; `rows`, an array of string arrays | No       |
| `Metric`  | `label`, `value`, optional `description`, all strings             | No       |
| `Divider` | `{}`                                                              | No       |

Specs use a root element ID and an elements map. Child IDs refer to entries in
that map. Use a tree with no cycles, missing children, or unreachable elements.
All text is literal, not HTML or Markdown. Arbitrary components, executable
actions, and dynamic expressions are not supported.

## Requesting input

The optional `input` accepts one question per tool call:

```json
{ "kind": "text", "prompt": "Name this report", "placeholder": "Weekly report" }
```

```json
{
	"kind": "select",
	"prompt": "Choose a format",
	"options": ["Brief", "Detailed"]
}
```

```json
{
	"kind": "confirm",
	"prompt": "Continue?",
	"message": "Generate the detailed report?"
}
```

The display remains visible while the tool waits. Text and selection questions
can be skipped. Confirmations return a boolean; Pi's confirmation API represents
both declining and dismissing as `false`. Aborting the turn cancels the pending
wait. Input requests require an attached UI.

Display content is retained in tool-result details so completed output can render
again when the conversation is reopened. Invalid content falls back to ordinary
tool-result rendering rather than executing arbitrary UI code.
