import fs from 'node:fs';
import postcss from 'postcss';
const folder='src/modules/zalocrm/assets/';
const files=['main.css','premium.css'];
const result=[];
for(const file of files){
  const css=postcss.parse(fs.readFileSync(folder+file,'utf8'));
  css.walkRules(rule=>{
    let parent=rule.parent;
    while(parent){if(parent.type==='atrule' && /keyframes$/i.test(parent.name))return;parent=parent.parent;}
    rule.selectors=rule.selectors.map(selector=>{
      if(/^(html|body|:root)(?=[\s.:#\[]|$)/.test(selector))return selector.replace(/^(html|body|:root)/,node=>node===':root'?'body.zalo-workspace':node+'.zalo-workspace');
      return 'body.zalo-workspace '+selector;
    });
  });
  result.push(css.toString());
}
fs.writeFileSync(folder+'workspace.css',result.join('\n'));
console.log('Scoped source styles to the Zalo workspace.');
