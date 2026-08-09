const dbName = process.env.MONGO_INITDB_DATABASE || "invoice";
const appUser = process.env.MONGO_APP_USER || "invoice_app";
const appPassword = process.env.MONGO_APP_PASSWORD;

if (!appPassword) {
  throw new Error("MONGO_APP_PASSWORD is required");
}

const appDb = db.getSiblingDB(dbName);

// Создаём пользователя приложения
if (!appDb.getUser(appUser)) {
  appDb.createUser({
    user: appUser,
    pwd: appPassword,
    roles: [
      {
        role: "read",
        db: dbName,
      },
    ],
  });
}

const forms = appDb.getCollection("document_forms");

// electricity
forms.replaceOne(
  { _id: "electricity" },
  {
    _id: "electricity",

    fields: [
      {
        id: "tariff_kw_day",
        label: "Тариф (день), ₽/кВт·ч",
        type: "number",
        unit: "₽/кВт·ч",
        required: true,
        tooltip: "Выделите на чеке дневной тариф",
        constraints: {
          min: 0,
          max: 999,
        },
      },

      {
        id: "tariff_kw_night",
        label: "Тариф (ночь), ₽/кВт·ч",
        type: "number",
        unit: "₽/кВт·ч",
        required: false,
        tooltip: "Выделите на чеке ночной тариф",
        constraints: {
          min: 0,
          max: 999,
        },
      },

      {
        id: "all_sum",
        label: "Вся сумма",
        type: "number",
        required: true,
        placeholder: "введите полную сумму",
      },
    ],

    auto_crop: {
      validation: [
        {
          id: "valid1",
          expected_text: "Акт сдачи-приемки",
          crop: {
            x: 0.2741921293034355,
            y: 0.03190883072652173,
            width: 0.20403120209932116,
            height: 0.022222221398827634,
          },
        },

        {
          id: "valid2",
          expected_text: "Всего оказано услуг на сумму",
          crop: {
            x: 0.08870921830405268,
            y: 0.8472934158988896,
            width: 0.19999896490368238,
            height: 0.017663817009324533,
          },
        },
      ],

      fields: {
        tariff_kw_day: {
          crop: {
            x: 0.5435455739721046,
            y: 0.3162393045217779,
            width: 0.07419316439975314,
            height: 0.014245013717197202,
          },
        },

        tariff_kw_night: {
          crop: {
            x: 0.5427391265329768,
            y: 0.35213673908911486,
            width: 0.0766125067171364,
            height: 0.011965811522445649,
          },
        },

        all_sum: {
          crop: {
            x: 0.6241903178848797,
            y: 0.819942989561871,
            width: 0.08467698110841392,
            height: 0.015954415363260865,
          },
        },
      },
    },
  },
  {
    upsert: true,
  }
);

// gas
forms.replaceOne(
  { _id: "gas" },
  {
    _id: "gas",

    fields: [
      {
        id: "consumption1",
        label:
          "Газ горючий кроме населения в пределах нормы (потребление общ.территории) за март 2025 г.",
        type: "number",
        unit: "кВт.ч",
        required: true,
        tooltip:
          "Выделите показания по Газ горючий кроме населения в пределах нормы (потребление общ.территории)",
        constraints: {
          min: 0,
          max: 999999,
        },
      },

      {
        id: "consumption2",
        label:
          "Газ горючий кроме населения сверх нормы (потребление общ.территории) за март 2025 г.",
        type: "number",
        unit: "кВт.ч",
        required: false,
        tooltip:
          "Выделите показания по Газ горючий кроме населения сверх нормы (потребление общ.территории) за март 2025 г.",
        constraints: {
          min: 0,
          max: 999999,
        },
      },

      {
        id: "Sum",
        label: "Всего по документу поступления от поставщика:",
        type: "text",
        required: true,
        placeholder: "мм.гггг",
        pattern: "^(0[1-9]|1[0-2])\\.\\d{4}$",
      },
    ],
  },
  {
    upsert: true,
  }
);