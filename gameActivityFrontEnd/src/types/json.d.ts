declare module "*.json" {
  const value: any;
  export default value;
}

interface TopicItem {
  topic_name: string;
  mission_id: string;
}

declare module "../../public/topic.json" {
  const value: TopicItem[];
  export default value;
}

interface BilibiliArea {
  name: string;
  children: {
    tid: number;
    name: string;
  }[];
}

declare module "../../public/bilibiliTid.json" {
  const value: BilibiliArea[];
  export default value;
}
