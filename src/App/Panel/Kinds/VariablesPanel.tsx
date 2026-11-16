import { actionLangValToText } from "@/languages/actionlang/prettyprinter";
import { Environment } from "@/languages/statecharts/interpreter/environment";

export function VariablesPanel({variables, environment}: {variables: Set<string>, environment?: Environment}) {
  if (environment) {
    return <div style={{columnWidth: 160}}>{[...environment.entries()]
      .map(([key, val]) => [key.split('.')[1], val]) // <-- drop scope information (only keep variable name)
      // .filter(([key]) => !key.startsWith('_')) // <-- drop builtin variables
      .sort(([keyA], [keyB]) => (keyA as string).localeCompare(keyB)) // <-- sort alphabetically
      .map(([key, val]) => <div>
        <span style={{
          // fontWeight: 'bold',
          color: key.startsWith('_') ? 'var(--inactive-fg-color)' : undefined,
        }}>
          {key}
          &nbsp;=&nbsp;
          {actionLangValToText(val)}
        </span>
      </div>)}
    </div>;
  }
  else {
    return <div style={{columnWidth: 160}}>{[...variables]
      .sort((a,b) => a.localeCompare(b)) // <-- sort alphabetically
      .map(key => <div>
        {key}
      </div>)}
    </div>;
  }
}
