
1. 使用正则表达式  获取最后一次出现字符"-"到第一次出现字符"#"之间的所有字符 ，最后如果重命名后全局没有出现  "诛仙世界" ， 则在最前面加上【诛仙世界】，有则不必加  。   注意改名后不要再带上博主的名称且不要再出现"-“这个字符
2. 获取页面指定href : Array.from(document.getElementsByClassName("uz1VJwFY TyuBARdT IdxE71f8")).map(item=>item.href).slice(1,10)
