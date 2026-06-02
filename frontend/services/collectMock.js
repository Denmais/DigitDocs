
export function collectMock({ task_id, fields }) {


  return Promise.resolve({

    result_id: 'mock_result',


    table: fields.map(f => ({
      id: f.id,


      label: f.id,

      value: f.value,

      display_value: f.value,

      valid: true,
    })),
  });
}
