import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clapperboard,
  FileImage,
  ImagePlus,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PromptGuideCopy } from "@/components/prompt-guide-copy";

const STEPS = [
  {
    number: "01",
    title: "先让 AI 读懂业务资料",
    text: "把相关 PPT、Word、产品图片、宣传册或已有文案发给 WorkBuddy、DeepSeek、豆包等常见 AI。告诉它视频给谁看、用在哪里、希望多长；让它先提炼事实，再拆分镜头。",
    icon: FileImage,
  },
  {
    number: "02",
    title: "拿到分段脚本和总提示词",
    text: "请 AI 按时间段写分镜：每段说明画面主体、动作、场景、镜头、光线、字幕或旁白。最后再要一段可直接粘贴到造境的完整提示词，以及参考图和参数建议。",
    icon: Sparkles,
  },
  {
    number: "03",
    title: "在造境选模型并补充参考图",
    text: "按任务选择视频模型。图生视频适合让已有产品图、人物或场景动起来；文生视频适合从描述开始。参考图用来固定外观和风格，首帧/尾帧可帮助控制视频开头和结尾。具体能力以模型选项为准。",
    icon: ImagePlus,
  },
  {
    number: "04",
    title: "调参数、生成，再小步迭代",
    text: "先确定横竖屏、时长和分辨率，再生成一版检查主体、动作、文字和镜头衔接。效果不理想时，一次只改一个重点，或补一张更明确的参考图；满意的提示词可保存到提示词库复用。",
    icon: SlidersHorizontal,
  },
];

const PARAMS = [
  ["画面比例", "横屏 16:9 适合会议、官网和大屏；竖屏 9:16 适合手机短视频。先按最终发布位置选。"],
  ["视频时长", "先做满足表达需要的短片。镜头越多、动作越复杂，越容易出现主体变化或衔接不稳。"],
  ["分辨率", "先用较低成本设置试画面和节奏，确认方向后再提高分辨率生成正式版本。"],
  ["参考素材", "产品外观用清晰产品图；人物形象用目标人物参考图；场景氛围用风格参考图。尽量让每张图各有用途。"],
];

export default function PromptGuidePage() {
  return (
    <main className="mx-auto max-w-6xl pb-10">
      <PageHeader
        eyebrow="快速上手 · 从资料到视频"
        title="新手提示词教程"
        description="不必一开始就会写复杂提示词。先把业务资料交给 AI 整理，再把分镜、参考图和参数带回造境生成。"
        actions={
          <Link
            href="/"
            className="lift inline-flex h-10 items-center gap-2 rounded-xl bg-[#7c6cff] px-4 text-sm font-medium text-white transition hover:bg-[#8b7dff]"
          >
            <Clapperboard className="size-4" />
            去创作工作台
            <ArrowRight className="size-4" />
          </Link>
        }
      />

      <section className="mb-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
          <p className="text-xs font-semibold tracking-[0.16em] text-[#a99cff]">先整理，再生成</p>
          <h2 className="mt-3 text-xl font-semibold text-white">把“我想做个宣传视频”变成能执行的镜头方案</h2>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            把已有业务资料交给你常用的 AI，请它只依据资料提炼重点，并按秒数拆成镜头。这样能减少遗漏关键信息，也让视频模型更清楚每一段要呈现什么。
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {["PPT / Word", "产品与场景图片", "宣传文案", "品牌色与标识"].map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-slate-300">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-200">
              <Check className="size-4" /> 提醒 AI 不要编造业务信息
            </p>
            <p className="mt-1.5 text-xs leading-5 text-slate-400">
              医疗、健康、产品功效、资质和数据尤其要以资料为准；缺少的信息让 AI 标注出来，确认后再用于生成。
            </p>
          </div>
        </div>

        <figure className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d1118]">
          <div className="border-b border-white/[0.07] px-4 py-3">
            <p className="text-sm font-medium text-slate-100">你提供的示例：从企业 PPT 整理出分段视频提示词</p>
            <p className="mt-1 text-xs text-slate-500">按时间拆镜头，并包含画面、字幕、旁白和风格描述</p>
          </div>
          <Image
            src="/images/prompt-guide-example.png"
            alt="用户提供的企业宣传视频提示词示例，展示了按 0 到 10 秒拆分的分镜脚本"
            width={880}
            height={953}
            priority
            className="h-auto max-h-[34rem] w-full object-contain object-top"
          />
          <figcaption className="px-4 py-3 text-xs leading-5 text-slate-500">
            示例把约 10 秒视频拆成多个时间段，逐段写明镜头主题、画面内容和屏幕短句。你可以让 AI 按自己的业务资料生成类似结构。
          </figcaption>
        </figure>
      </section>

      <section className="mb-6">
        <div className="mb-3">
          <p className="text-xs font-semibold tracking-[0.16em] text-[#a99cff]">四步完成</p>
          <h2 className="mt-1.5 text-lg font-semibold text-white">从资料到生成结果</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map(({ number, title, text, icon: Icon }) => (
            <article key={number} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[#9e91ff]">{number}</span>
                <Icon className="size-4 text-slate-500" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-slate-100">{title}</h3>
              <p className="mt-2 text-xs leading-6 text-slate-400">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
        <PromptGuideCopy />
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
          <p className="text-xs font-semibold tracking-[0.16em] text-[#a99cff]">生成视频时怎么选</p>
          <h2 className="mt-2 text-lg font-semibold text-white">参数和参考图的实用建议</h2>
          <div className="mt-4 divide-y divide-white/[0.07]">
            {PARAMS.map(([title, description]) => (
              <div key={title} className="py-3 first:pt-0 last:pb-0">
                <h3 className="text-sm font-medium text-slate-200">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl bg-black/20 p-3 text-xs leading-5 text-slate-400">
            <span className="font-medium text-slate-200">小技巧：</span>
            提示词说清“谁/什么在什么场景做什么动作”，再补充镜头、光线和氛围。字幕尽量简短，复杂文案建议后期添加。
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#7c6cff]/20 bg-[#7c6cff]/[0.07] px-5 py-4">
        <div>
          <p className="text-sm font-medium text-white">提示词准备好了？去工作台上传参考图并开始生成。</p>
          <p className="mt-1 text-xs text-slate-400">生成效果不确定时，先试一版，再逐项调整。</p>
        </div>
        <div className="flex gap-2">
          <Link href="/prompts" className="inline-flex h-9 items-center rounded-lg border border-white/10 px-3 text-xs text-slate-200 hover:bg-white/[0.05]">
            打开提示词库
          </Link>
          <Link href="/" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#7c6cff] px-3 text-xs font-medium text-white hover:bg-[#8b7dff]">
            开始创作 <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>
    </main>
  );
}
