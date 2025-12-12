import { ChangeEvent, Dispatch, ReactElement, SetStateAction, useState } from "react"
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloseIcon from '@mui/icons-material/Close';
import HelpIcon from '@mui/icons-material/Help';
import CheckIcon from '@mui/icons-material/Check';
import { detectConnections } from "@/statecharts/detect_connections";
import { VisualEditor, VisualEditorState } from "../VisualEditor/VisualEditor";
import { Tooltip } from "../Components/Tooltip";
import { count } from "@/util/util";
import { prettyNumber } from "@/util/pretty";
import styles from "../App.module.css";
import { buf2base64, deflateBuffer, str2buf } from "@/compression/deflate";
import { useShortcuts } from "@/hooks/useShortcuts";

// The "file open"-dialog is a bit hacked together, but hopefully usable at the moment.
// Properties and traces are reusable for models that have the same plant.
// So the idea is that you can mix a model with properties and traces from various files.

type Trace = [string, any[]];
type FileImport = readonly [File, any, boolean, boolean[], boolean[]];

function removeFileExtension(filename: string) {
  return filename.toLowerCase().endsWith(".statebuddy.json")
    ? filename.substring(0, filename.length-16)
    : filename.toLowerCase().endsWith(".json")
      ? filename.substring(0, filename.length-5)
      : filename;
}

async function attemptParse(file: File, importAll: boolean): Promise<FileImport|undefined> {
  try {
    const buf = await file.arrayBuffer();
    const str = new TextDecoder().decode(buf);
    const json = JSON.parse(str);
    return [file, json, importAll, (json.properties as string[]).map(_ => importAll), (json.savedTraces as Trace[]).map(_ => importAll)] as const;
  }
  catch (e) {
    console.warn("parse error:", e);
  }
}

function Properties({properties, propsToImport, setPropsToImport, propToIdx}: {properties: string[], propsToImport: Set<string>, setPropsToImport: Dispatch<SetStateAction<Set<string>>>, propToIdx: Map<string, [number,number][]>}) {
  return <div>
      <label>
        <input type="checkbox"
          checked={properties.every((prop: string) => propsToImport.has(prop))}
          onChange={e => {
            if (e.target.checked) {
              setPropsToImport(props => new Set([...props, ...properties]));
            }
            else {
              setPropsToImport(props => new Set(props).difference(new Set(properties)));
            }
          }}
          disabled={properties.length===0}
          />
        {properties.length > 0
          ? <>all {properties.length} properties</>
          : <span style={{color: 'var(--inactive-fg-color)'}}>(no properties)</span>
        }
      </label>
    <ul>
    {properties.map(p => {
      const dupes = propToIdx.get(p)!;
      return <div>
          <label>
            <input type="checkbox"
              checked={propsToImport.has(p)}
              onChange={e => {
                if (e.target.checked) {
                  setPropsToImport(ps => new Set([...ps, p]));
                }
                else {
                  setPropsToImport(ps => new Set([...ps].filter(px => px !== p)));
                }
              }}/>
            {p}
            {dupes.length > 1 && <>
              &nbsp;<div style={{display: 'inline-block', color: 'var(--status-ok-color)'}}>({dupes.length} duplicates)</div>
            </>}
          </label>
        </div>;
      })}
    </ul>
  </div>;
}

function Traces({traces, toImport, setToImport}: {traces: Trace[], toImport: boolean[], setToImport: (callback: (old: boolean[]) => boolean[]) => void}) {
  return <div>
      <label>
        <input type="checkbox"
          checked={!toImport.some(x => !x)}
          onChange={e => setToImport(toImport => toImport.map(_ => e.target.checked))}
          disabled={traces.length===0}
        />
        {traces.length > 0
          ? <>all {traces.length} traces</>
          : <span style={{color: 'var(--inactive-fg-color)'}}>(no traces)</span>
        }
      </label>
    <ul>
      {traces.map(([name, trace], j) =>
      <div>
        <label>
          <input type="checkbox"
            checked={toImport[j]}
            onChange={e => setToImport(toImport => toImport.with(j, e.target.checked))}
          />
          {name !== "" && name || "(untitled)"}
          &nbsp;<div style={{display: 'inline-block', color: 'var(--inactive-fg-color)'}}>({trace.length} events)</div>
        </label>
      </div>)}
    </ul>
  </div>;
}

function ModelPreview({concreteSyntax}: {concreteSyntax: VisualEditorState}) {
  return <div style={{width: 192, overflow: "auto", height: 120, display: 'inline-block', verticalAlign: 'top'}}>
    <div style={{pointerEvents: 'none'}}>
      <VisualEditor state={concreteSyntax}
        commitState={() => {}}
        replaceState={() => {}}
        conns={detectConnections(concreteSyntax)}
        findText=""
        highlightActive={new Set()}
        highlightTransitions={[]}
        setModal={() => {}}
        zoom={0.1}
        insertMode="and"
        syntaxErrors={[]}
        />
    </div>
  </div>;
}

export function OpenFile({onClose, properties, traces, editorState, bytes, modelName, replaceModel, setProperties, setTraces}: {onClose: () => void, properties: string[], traces: Trace[], editorState: VisualEditorState, bytes: number, modelName: string, replaceModel: Dispatch<(oldState: VisualEditorState) => VisualEditorState>, setProperties: Dispatch<SetStateAction<string[]>>, setTraces: Dispatch<SetStateAction<Trace[]>>}) {

  useShortcuts([
    {keys: ["Escape"], action: onClose},
  ]);

  const [files, setFiles] = useState<FileImport[]|"pending">([]);
  const [propsToImport, setPropsToImport] = useState<Set<string>>(new Set());
  const [tracesToKeep, setTracesToKeep] = useState<boolean[]>(traces.map(_ => true));
  const propToIdx = new Map<string, [number, number][]>();
  const addProp = (prop: string, i: number, j: number) => {
    const arr = propToIdx.get(prop) || [];
    arr.push([i,j]);
    propToIdx.set(prop, arr);
  };
  if (files !== "pending") {
    // iterate over all the properties
    files.forEach((f, i) => {
      (f[1].properties as string[]).forEach((prop, j) => addProp(prop, i, j));
    });
  }
  properties.forEach((prop, j) => addProp(prop, -1, j));

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles("pending");
      if (e.target.files.length === 1) {
        const file = e.target.files[0];
        attemptParse(file, true)
        .then(f => {
          setFiles(f && [f] || []);
          setPropsToImport(new Set((f ? f[1].properties as string[]: [])));
          setTracesToKeep(traces.map(_ => false));
        });
      }
      else {
        Promise.all(
          [...e.target.files].map(file => attemptParse(file, false))
        )
        .then(files => {
          setFiles(files.filter(x => x !== undefined));
          setPropsToImport(new Set(properties));
          setTracesToKeep(traces.map(_ => true));
        });
      }
    }
  }
  const willImportModel = files!=="pending" && files.some(([_0, _1, importModel]) => importModel);
  const totalNrOfProperties = (propsToImport.difference(new Set(properties))).size;
  const totalNrOfTraces = (files!=="pending" && files.reduce((acc, [_0, _1, _2, _3, importTrace]) => acc+count(importTrace, x=>x), 0) || 0);

  let description = "";
  if (willImportModel || totalNrOfProperties || totalNrOfTraces) {
    description += "will ";
  }
  if (willImportModel) {
    description += "replace model";
  }

  if (totalNrOfProperties || totalNrOfTraces) {
    if (willImportModel) {
      description += " and ";
    }
    description += "import "
  }
  if (totalNrOfProperties) {
    description += `${totalNrOfProperties} properties`;
  }
  if (totalNrOfTraces) {
    if (totalNrOfProperties) {
      description += ", ";
    }
    description += `${totalNrOfTraces} traces`;
  }

  const getTraces = () => {
    if (files !== "pending") {
      return [
        ...traces.filter((_, i) => tracesToKeep[i]),
        ...files.reduce((traces, f) => [
          ...traces,
          ...(f[1].savedTraces as Trace[]).filter((_,i) => f[4][i]),
        ], [] as Trace[]),
      ];
    }
    else return [];
  }

  const onImport = () => {
    if (files !== "pending") {
      const model = files.find(f => f[2]);
      if (model) {
        replaceModel(() => model[1].editorState);
      }
      setProperties([...propsToImport]);
      setTraces(getTraces());
      onClose();
    }
  };

  const onImportNewWindow = () => {
    if (files !== "pending") {
      const model = files.find(f => f[2])?.[1];
      const properties = [...propsToImport];
      const traces = getTraces();
      deflateBuffer(str2buf(JSON.stringify({
        ...(model || {editorState}),
        properties,
        savedTraces: traces,
      })))
      .then(buf => {
        window.open("#"+buf2base64(buf), '_blank');
      });
    };
  };

  return <div style={{display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 4, padding: 4}}>
    {/* Tip: you can also drop file(s) into StateBuddy to open them. */}
    <input type="file" accept=".statebuddy.json" multiple onChange={handleFileChange}/>
    {files !== "pending" && files.length>0 &&
      <>
        <table>
          <thead>
            <tr>
              <th scope="col">file</th>
              <th scope="col">size</th>
              <th scope="col">
                model
                &nbsp;
                <Tooltip tooltip="Only one model can be imported. It will replace the current model.">
                  <HelpIcon fontSize="small"/>
                </Tooltip>
              </th>
              <th scope="col">properties</th>
              <th scope="col">traces</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                {/* <input type="checkbox"
                  checked={!willImportModel && properties.every(prop => propsToImport.has(prop))}
                /> */}
                (current model)
              </td>
              <td>{prettyNumber(bytes)} bytes</td>
              <td>
                <label>
                  <input type="checkbox"
                    checked={!willImportModel}
                    onChange={e => {
                      if (e.target.checked) {
                        // @ts-ignore
                        setFiles(fs => {
                          if (fs !== "pending")
                            return fs.map(f => f.with(2, false))
                          else
                            return fs;
                        });
                      }
                    }}/>
                  <span style={{fontWeight: 600}}>{modelName}</span>
                  <br/>
                  <ModelPreview concreteSyntax={editorState}/>
                </label>
              </td>
              <td>
                <Properties properties={properties} propToIdx={propToIdx} propsToImport={propsToImport} setPropsToImport={setPropsToImport}/>
              </td>
              <td>
                <Traces traces={traces} toImport={tracesToKeep} setToImport={setTracesToKeep}/>
              </td>
            </tr>
            {files.map(([file, json, importModel, importProperties, importTraces], i) => <tr>
              <td>
                {/* <label> */}
                  {/* <input type="checkbox"
                    checked={importModel
                      && importProperties.every(x => x)
                      && importTraces.every(x => x)}
                    onChange={e => {
                      setFiles(files.toSpliced(i, 1, [file, json, e.target.checked, importProperties.map(() => e.target.checked), importTraces.map(() => e.target.checked)]));
                      setPropsToImport(props => {
                        if (e.target.checked) {
                          return new Set([...props, ...json.properties]);
                        }
                        else {
                          return new Set([...props].filter(px => !json.properties.includes(px)));
                        }
                      })
                    }}/> */}
                  {file.name}
                {/* </label> */}
              </td>
              <td>{prettyNumber(file.size)} bytes</td>
              <td>
                <label>
                  <input type="checkbox" checked={importModel} onChange={e => setFiles(files.map(([file, json, importModel, importProperties, importTraces], I) => [file, json, e.target.checked ? i===I : false, importProperties, importTraces]))}/>
                  <span style={{fontWeight: 600}}>{json.modelName}</span>
                  <br/>
                  <ModelPreview concreteSyntax={json.editorState}/>
                </label>
              </td>
              <td>
                <Properties properties={json.properties} propsToImport={propsToImport} setPropsToImport={setPropsToImport} propToIdx={propToIdx}/>
              </td>
              <td>
                <Traces traces={json.savedTraces} toImport={importTraces} setToImport={(setter) => {
                  setFiles(files => {
                    if (files !== "pending") {
                      return files.with(i, [file, json, importModel, importProperties, setter(files[i][4])]);
                    }
                    return files;
                  });
                }}/>
              </td>
            </tr>)}
          </tbody>
        </table>
        <div style={{alignSelf: 'start'}}>{description || "(no items selected)"}</div>
      </>}
      <div className={styles.toolbar} style={{gap: 4}}>
        <button disabled={!willImportModel && !totalNrOfProperties && !totalNrOfTraces} onClick={onImport}>
          <CheckIcon fontSize="small"/>
          &nbsp;
          OK
        </button>
        <Tooltip tooltip="open result in new window" above>
        <button disabled={!willImportModel && !totalNrOfProperties && !totalNrOfTraces} onClick={onImportNewWindow}>
          <OpenInNewIcon fontSize="small"/>
          &nbsp;
          OK (new window)
        </button>
        </Tooltip>
        {/* gap */}
        <button
            type="button" // <-- prevent form submission on click
            onClick={onClose}
            style={{marginLeft: 'auto'}}
            >
          <CloseIcon fontSize="small"/>
          Cancel
        </button>
      </div>
  </div>
}