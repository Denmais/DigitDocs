export async function extractFieldMock({
  task_id,
  field_id,
  page,
  crop,
}) {


  console.log('POST /api/extract-field', {
    task_id,
    field_id,
    page,
    crop,
  });

  await new Promise((r) => setTimeout(r, 1200));

  return {
    field: {
      id: field_id,

      value: '4.32',

      confidence: 0.87,
    },
  };
}
