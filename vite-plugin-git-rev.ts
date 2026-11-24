import { exactRegex } from '@rolldown/pluginutils'
import { $ } from 'bun';

const virtualModuleId = 'virtual:git-rev';

const gitRev = await $`git rev-parse HEAD`;

export default function pluginGitRev() {
  const resolvedVirtualModuleId = '\0' + virtualModuleId

  return {
    name: 'git-rev', // required, will show up in warnings and errors
    resolveId: {
      filter: { id: exactRegex(virtualModuleId) },
      handler() {
        return resolvedVirtualModuleId
      },
    },
    load: {
      filter: { id: exactRegex(resolvedVirtualModuleId) },
      handler() {
        return `export const gitRev = ${JSON.stringify(gitRev.text())}`
      },
    },
  }
}