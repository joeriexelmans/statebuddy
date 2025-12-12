import { FormEvent, InputHTMLAttributes, useEffect, useState } from "react";
import { Tooltip } from "./Tooltip";

// freely editable text input, that doesn't invoke the 'onChange' callback after every change, but instead has a callback for when the user presses Enter.
export function EnterText({value, onEnter, onChange, ...props}: InputHTMLAttributes<HTMLInputElement> & {value: string, onEnter: (str: string) => void}) {
  const [str, setStr] = useState<string>(value);
  const onFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onEnter(str);
  }
  useEffect(() => {
    // if the value-property changes, also update the displayed text
    setStr(value);
  }, [value]);
  return <form onSubmit={onFormSubmit}>
    <Tooltip showWhen="focus" tooltip="enter to confirm">
      <input
        value={str}
        onChange={e => setStr(e.target.value)}
        {...props}
      />
    </Tooltip>
  </form>;
}
