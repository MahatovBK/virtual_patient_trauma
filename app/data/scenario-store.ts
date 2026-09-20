import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ScenarioDefinition } from "./scenarios";

const scenariosPath = path.join(process.cwd(), "app", "data", "scenarios.json");

type StoredScenario = ScenarioDefinition;

function isLegacyImport(scenario: StoredScenario) {
  return scenario.title.length > 80 || scenario.description.includes("Описание:");
}

function normalizeLegacyImport(scenario: StoredScenario): StoredScenario {
  if (!isLegacyImport(scenario) && scenario.id !== "shoulder-dislocation") return scenario;

  const source = `${scenario.title} ${scenario.description}`;
  const isShoulderCase = /плечев|борьб|потянули за руку/i.test(source);

  if (isShoulderCase) {
    return {
      ...scenario,
      id: "shoulder-dislocation",
      title: "Ситуационная задача №1",
      description: "Пациент получил травму правого плеча во время борьбы. Есть резкая боль, деформация и резкое ограничение движений.",
      difficulty: "Средний",
      patient: "Пациент К., 21 год",
      xrayImage: "/xray-right-shoulder.svg",
      diagnosis: "Передний вывих правого плечевого сустава",
      answerRules: [
        { keywords: ["привет", "здравств", "добрый", "доброе", "доброе утро"], answerVariants: ["Здравствуйте. У меня сильно болит правое плечо.", "Привет. Я повредил правое плечо и почти не могу им двигать."] },
        { keywords: ["когда", "начал", "сколько времени", "давно"], answerVariants: ["Травма произошла около 30 минут назад, во время соревнований по борьбе.", "Это случилось примерно полчаса назад на соревнованиях."] },
        { keywords: ["механизм", "произош", "травм", "борьб", "потянул"], answerVariants: ["Во время броска меня резко потянули за правую руку. Я почувствовал щелчок и сразу резкую боль.", "Меня дёрнули за руку во время броска. После щелчка сразу появилась сильная боль."] },
        { keywords: ["где", "локализ", "место", "какая сторона", "какое плечо"], answerVariants: ["Болит справа, в области плечевого сустава.", "Боль сосредоточена в правом плече, ближе к суставу."] },
        { keywords: ["пальц", "кист", "чувств", "онем", "слабост ру"], answerVariants: ["Пальцами двигаю, кисть чувствую, онемения нет.", "Кисть и пальцы чувствую нормально, двигать ими могу."] },
        { keywords: ["что беспокоит", "жалоб", "симптом", "чувствуете"], answerVariants: ["Сильно болит правое плечо, оно выглядит деформированным, и я почти не могу двигать рукой.", "Главное - резкая боль и ощущение, что правое плечо находится не на месте."] },
        { keywords: ["движен", "двиг", "поднять", "пассивн", "активн"], answerVariants: ["Движения резко ограничены и болезненны, даже если кто-то пытается осторожно подвигать рукой.", "Я не могу нормально поднять руку. Любая попытка движения вызывает боль."] },
        { keywords: ["осмотр", "отек", "отёк", "западен", "деформац", "пальпац"], answerVariants: ["Есть умеренная отёчность и западение мягких тканей. Головка плеча смещена, при пассивном движении ощущается пружинящее сопротивление.", "Плечо припухло, контур сустава изменён, а при попытке движения рука пружинит."] },
        { keywords: ["голов", "живот", "другие боли", "ещё болит", "еще болит"], answer: "Голова и живот не болят. Больше ничего не беспокоит, только правое плечо." },
        { keywords: ["дыхани", "дыш", "одышк"], answer: "Дышу нормально, одышки нет." },
        { keywords: ["сердц", "сердцебиен", "пульс"], answer: "Сердце не беспокоит, сильного сердцебиения не чувствую." },
        { keywords: ["сознани", "головокруж", "обморок"], answer: "Сознание не терял, головокружения не было." },
        { keywords: ["температур", "озноб", "лихорад"], answer: "Температуры и озноба нет." },
        { keywords: ["давлен", "гипертон"], answer: "Давление обычно нормальное, гипертонией не страдаю." },
        { keywords: ["аллерг", "препарат", "лекарств"], answer: "Аллергии на лекарственные препараты не припоминаю." },
        { keywords: ["рентген", "снимок", "снимке", "исследован"], answer: "Рентгеновский снимок правого плечевого сустава готов.", imageUrl: "/xray-right-shoulder.svg" },
        { keywords: ["другие", "остальн", "температур", "систем"], answer: "По остальным органам и системам без особенностей." },
      ],
      defaultAnswer: "Я не понял вопрос.",
    };
  }

  return {
    ...scenario,
    title: scenario.title.split(".")[0] || "Новая клиническая задача",
    description: "Клинический случай загружен. Уточните у пациента жалобы, время начала и обстоятельства заболевания.",
    patient: scenario.patient.length > 70 ? "Пациент из клинической задачи" : scenario.patient,
  };
}

export async function readScenarios() {
  const scenarios = JSON.parse(await readFile(scenariosPath, "utf8")) as StoredScenario[];
  const normalizedScenarios = [...new Map(scenarios.map(normalizeLegacyImport).map((scenario) => [scenario.id, scenario])).values()];

  if (JSON.stringify(scenarios) !== JSON.stringify(normalizedScenarios)) {
    await writeFile(scenariosPath, `${JSON.stringify(normalizedScenarios, null, 2)}\n`, "utf8");
  }

  return normalizedScenarios;
}

export async function appendScenario(scenario: StoredScenario) {
  const scenarios = await readScenarios();
  scenarios.push(scenario);
  await writeFile(scenariosPath, `${JSON.stringify(scenarios, null, 2)}\n`, "utf8");
}
