"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export const PROMPT_BRIEF_TEMPLATE = `请阅读我提供的 PPT、Word、图片或其他业务资料，帮我整理一份可用于 AI 视频生成的提示词方案。

请先从资料中提取真实信息，不要擅自编造产品功能、数据、资质、疗效或品牌主张；资料缺失的地方请标注“需要补充”。

视频目标：介绍什么产品、服务或活动？
目标观众：视频主要给谁看？
发布场景：用于会议、展厅、公众号、短视频平台还是其他渠道？
视频规格：建议时长、横屏/竖屏比例、整体风格和节奏。

请按时间拆分分镜。每个镜头都写清：
1. 时间段（例如 0–2 秒）和镜头主题
2. 画面主体、人物/产品动作、场景与构图
3. 镜头运动、景别、光线和色彩
4. 屏幕文字或旁白；没有需要的文字请写“无”
5. 适合提供给视频模型的参考图建议

最后请给出：
A. 一段可以直接粘贴到造境的视频生成提示词，包含镜头衔接、风格、光线和声音氛围。
B. 推荐上传的参考图类型，以及每张图应该帮助模型固定什么内容。
C. 建议的视频比例、时长、分辨率；如果不同模型适合的设置不同，请说明取舍。
D. 需要避免的画面或表达。

要求：画面描述具体、镜头之间连贯、文字简短可读；不要把长篇文案硬塞进画面。`;

export function PromptGuideCopy() {
  const [copied, setCopied] = useState(false);

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(PROMPT_BRIEF_TEMPLATE);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1018]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-100">可复制的资料整理指令</p>
          <p className="mt-1 text-xs text-slate-500">上传业务资料后，把这段话发给 WorkBuddy、DeepSeek、豆包等 AI</p>
        </div>
        <button
          type="button"
          onClick={() => void copyTemplate()}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#7c6cff]/30 bg-[#7c6cff]/10 px-3 text-xs font-medium text-[#c2baff] transition hover:bg-[#7c6cff]/20"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "已复制" : "复制指令"}
        </button>
      </div>
      <pre className="max-h-[34rem] overflow-auto whitespace-pre-wrap p-4 text-xs leading-6 text-slate-300 sm:p-5 sm:text-[13px]">
        {PROMPT_BRIEF_TEMPLATE}
      </pre>
    </div>
  );
}
