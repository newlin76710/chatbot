/**
 * 娜米機器人流程範本
 * 適用平台：LINE、FB Messenger（流程引擎平台無關）
 * 包含 4 個已完成整理的問卷流程
 */

const TEMPLATES = [
  // ============================================================
  // Survey 1：娜米｜活動專屬基本資料 ／ 配對基本資料
  // ============================================================
  {
    name: '娜米｜配對基本資料問卷',
    description: '配對基本資料問卷，收集感情狀態、地區、出生年次、學歷、身高體重、職業、手機號碼（LINE / FB 通用）',
    platform: 'all',
    nodes: [
      {
        id: 'trigger_1',
        type: 'trigger',
        position: { x: 50, y: 200 },
        data: {
          label: '觸發器',
          trigger: {
            type: 'keyword',
            keywords: ['填寫問卷', '開始配對', '基本資料', '填問卷', '開始'],
            matchMode: 'contains',
          },
        },
      },
      {
        id: 'msg_q1',
        type: 'message',
        position: { x: 280, y: 200 },
        data: {
          label: 'Q1 感情狀態',
          messages: [{
            type: 'text',
            text: '為了要參加活動和配對，需要關於你的 6 項基本資料喔！👊\n1. 請問你目前的感情狀態是？',
            quickReplies: [
              { label: '單身未婚', text: '單身未婚' },
              { label: '已婚', text: '已婚' },
              { label: '交往中', text: '交往中' },
              { label: '離婚無子', text: '離婚無子' },
              { label: '離婚有子', text: '離婚有子' },
            ],
          }],
        },
      },
      {
        id: 'input_q1',
        type: 'input',
        position: { x: 280, y: 380 },
        data: {
          label: '儲存感情狀態',
          messages: [],
          inputField: 'maritalStatus',
          inputType: 'text',
        },
      },
      {
        id: 'msg_q2',
        type: 'message',
        position: { x: 280, y: 520 },
        data: {
          label: 'Q2 地區',
          messages: [{
            type: 'text',
            text: '2. 請選擇你想參加活動的城市',
            quickReplies: [
              { label: '台北', text: '台北' },
              { label: '新竹', text: '新竹' },
              { label: '台中', text: '台中' },
              { label: '台南', text: '台南' },
              { label: '高雄', text: '高雄' },
            ],
          }],
        },
      },
      {
        id: 'input_q2',
        type: 'input',
        position: { x: 280, y: 680 },
        data: { label: '儲存地區', messages: [], inputField: 'city', inputType: 'text' },
      },
      {
        id: 'msg_q3',
        type: 'message',
        position: { x: 280, y: 820 },
        data: {
          label: 'Q3 出生年次',
          messages: [{ type: 'text', text: '3. 你是（民國）幾年次的呢？' }],
        },
      },
      {
        id: 'input_q3',
        type: 'input',
        position: { x: 280, y: 960 },
        data: { label: '儲存出生年次', messages: [], inputField: 'birthYear', inputType: 'text' },
      },
      {
        id: 'msg_q4',
        type: 'message',
        position: { x: 280, y: 1100 },
        data: {
          label: 'Q4 學歷',
          messages: [{
            type: 'text',
            text: '4. 你的最高學歷是？',
            quickReplies: [
              { label: '國中', text: '國中' },
              { label: '高中', text: '高中' },
              { label: '大學', text: '大學' },
              { label: '碩士', text: '碩士' },
              { label: '博士', text: '博士' },
            ],
          }],
        },
      },
      {
        id: 'input_q4',
        type: 'input',
        position: { x: 280, y: 1260 },
        data: { label: '儲存學歷', messages: [], inputField: 'education', inputType: 'text' },
      },
      {
        id: 'msg_q5',
        type: 'message',
        position: { x: 280, y: 1400 },
        data: {
          label: 'Q5 身高體重',
          messages: [{ type: 'text', text: '5. 你的身高/體重？(例如：175cm/80kg)' }],
        },
      },
      {
        id: 'input_q5',
        type: 'input',
        position: { x: 280, y: 1540 },
        data: { label: '儲存身高體重', messages: [], inputField: 'heightWeight', inputType: 'text' },
      },
      {
        id: 'msg_q6',
        type: 'message',
        position: { x: 280, y: 1680 },
        data: {
          label: 'Q6 職業',
          messages: [{ type: 'text', text: '6. 你目前的職業？（例如：資訊工程師）' }],
        },
      },
      {
        id: 'input_q6',
        type: 'input',
        position: { x: 280, y: 1820 },
        data: { label: '儲存職業', messages: [], inputField: 'occupation', inputType: 'text' },
      },
      {
        id: 'cond_job',
        type: 'condition',
        position: { x: 280, y: 1980 },
        data: {
          label: '職業分支（自由業／服務業）',
          conditionMode: 'or',
          conditions: [
            { field: 'var.occupation', operator: 'contains', value: '自由業' },
            { field: 'var.occupation', operator: 'contains', value: '服務業' },
          ],
        },
      },
      {
        id: 'msg_freelance',
        type: 'message',
        position: { x: 100, y: 2160 },
        data: {
          label: '追問自由業／服務業細節',
          messages: [{ type: 'text', text: '自由業／服務業的範圍有點廣，方便再請問一下工作內容嗎？(例如：直銷/翻譯/餐飲/美髮）' }],
        },
      },
      {
        id: 'input_jobdetail',
        type: 'input',
        position: { x: 100, y: 2300 },
        data: { label: '儲存職業細節', messages: [], inputField: 'occupationDetail', inputType: 'text' },
      },
      {
        id: 'msg_q7',
        type: 'message',
        position: { x: 280, y: 2440 },
        data: {
          label: 'Q7 手機號碼',
          messages: [{ type: 'text', text: '6. 最後，你的聯絡手機號碼是？' }],
        },
      },
      {
        id: 'input_q7',
        type: 'input',
        position: { x: 280, y: 2580 },
        data: { label: '儲存手機號碼', messages: [], inputField: 'phoneNumber', inputType: 'phone' },
      },
      {
        id: 'msg_confirm',
        type: 'message',
        position: { x: 280, y: 2720 },
        data: {
          label: '結束感謝',
          messages: [{
            type: 'text',
            text: '感謝你！請確認以下資訊是否正確：\n感情狀態：{{var.maritalStatus}}\n地區：{{var.city}}\n出生年：{{var.birthYear}}\n學歷：{{var.education}}\n身高體重：{{var.heightWeight}}\n職業：{{var.occupation}}\n手機：{{var.phoneNumber}}',
            quickReplies: [
              { label: '資料正確', text: '資料正確' },
              { label: '訊息有錯', text: '訊息有錯' },
            ],
          }],
        },
      },
      {
        id: 'input_confirm',
        type: 'input',
        position: { x: 280, y: 2880 },
        data: { label: '確認回覆', messages: [], inputField: 'dataConfirm', inputType: 'text' },
      },
      {
        id: 'cond_confirm',
        type: 'condition',
        position: { x: 280, y: 3020 },
        data: {
          label: '資料確認分支',
          conditionMode: 'and',
          conditions: [{ field: 'var.dataConfirm', operator: 'equals', value: '資料正確' }],
        },
      },
      {
        id: 'action_tag',
        type: 'action',
        position: { x: 100, y: 3200 },
        data: {
          label: '標記回答完畢',
          actions: [{ type: 'addTag', tag: '回答完畢' }],
        },
      },
      {
        id: 'msg_correct',
        type: 'message',
        position: { x: 100, y: 3360 },
        data: {
          label: '資料正確回覆',
          messages: [{ type: 'text', text: '好的，我們會先幫你進行初步篩選並有專人與你聯繫。若方便請留下你的電話及聯繫時間，感謝 ❤️' }],
        },
      },
      {
        id: 'msg_wrong',
        type: 'message',
        position: { x: 460, y: 3200 },
        data: {
          label: '訊息有錯回覆',
          messages: [{ type: 'text', text: '再麻煩您回覆正確的資訊喔！例如：姓名錯誤，直接寫下正確姓名即可 ❤️' }],
        },
      },
      {
        id: 'end_1',
        type: 'end',
        position: { x: 280, y: 3540 },
        data: { label: '結束' },
      },
    ],
    edges: [
      { id: 'e1', source: 'trigger_1', target: 'msg_q1' },
      { id: 'e2', source: 'msg_q1', target: 'input_q1' },
      { id: 'e3', source: 'input_q1', target: 'msg_q2' },
      { id: 'e4', source: 'msg_q2', target: 'input_q2' },
      { id: 'e5', source: 'input_q2', target: 'msg_q3' },
      { id: 'e6', source: 'msg_q3', target: 'input_q3' },
      { id: 'e7', source: 'input_q3', target: 'msg_q4' },
      { id: 'e8', source: 'msg_q4', target: 'input_q4' },
      { id: 'e9', source: 'input_q4', target: 'msg_q5' },
      { id: 'e10', source: 'msg_q5', target: 'input_q5' },
      { id: 'e11', source: 'input_q5', target: 'msg_q6' },
      { id: 'e12', source: 'msg_q6', target: 'input_q6' },
      { id: 'e13', source: 'input_q6', target: 'cond_job' },
      { id: 'e14', source: 'cond_job', target: 'msg_freelance', sourceHandle: 'true' },
      { id: 'e15', source: 'cond_job', target: 'msg_q7', sourceHandle: 'false' },
      { id: 'e16', source: 'msg_freelance', target: 'input_jobdetail' },
      { id: 'e17', source: 'input_jobdetail', target: 'msg_q7' },
      { id: 'e18', source: 'msg_q7', target: 'input_q7' },
      { id: 'e19', source: 'input_q7', target: 'msg_confirm' },
      { id: 'e20', source: 'msg_confirm', target: 'input_confirm' },
      { id: 'e21', source: 'input_confirm', target: 'cond_confirm' },
      { id: 'e22', source: 'cond_confirm', target: 'action_tag', sourceHandle: 'true' },
      { id: 'e23', source: 'cond_confirm', target: 'msg_wrong', sourceHandle: 'false' },
      { id: 'e24', source: 'action_tag', target: 'msg_correct' },
      { id: 'e25', source: 'msg_correct', target: 'end_1' },
      { id: 'e26', source: 'msg_wrong', target: 'end_1' },
    ],
  },

  // ============================================================
  // Survey 2：FB 娜米｜脫單攻略電子書問卷
  // ============================================================
  {
    name: 'FB 娜米｜脫單攻略電子書問卷',
    description: '脫單攻略電子書問卷，收集居住地、學歷、身高體重、職業、出生月日',
    platform: 'all',
    nodes: [
      {
        id: 'trigger_1',
        type: 'trigger',
        position: { x: 50, y: 200 },
        data: {
          label: '觸發器',
          trigger: { type: 'keyword', keywords: ['脫單攻略', '免費索取', '電子書'], matchMode: 'contains' },
        },
      },
      {
        id: 'msg_q1',
        type: 'message',
        position: { x: 280, y: 200 },
        data: {
          label: 'Q1 居住地',
          messages: [{
            type: 'text',
            text: '2. 請選擇你想參加活動的城市',
            quickReplies: [
              { label: '台北', text: '台北' },
              { label: '新竹', text: '新竹' },
              { label: '台中', text: '台中' },
              { label: '台南', text: '台南' },
              { label: '高雄', text: '高雄' },
            ],
          }],
        },
      },
      {
        id: 'input_q1',
        type: 'input',
        position: { x: 280, y: 380 },
        data: { label: '儲存居住地', messages: [], inputField: 'city', inputType: 'text' },
      },
      {
        id: 'msg_q2',
        type: 'message',
        position: { x: 280, y: 520 },
        data: {
          label: 'Q2 學歷',
          messages: [{
            type: 'text',
            text: '3. 你的最高學歷是？',
            quickReplies: [
              { label: '國中', text: '國中' },
              { label: '高中', text: '高中' },
              { label: '大學', text: '大學' },
              { label: '碩士', text: '碩士' },
              { label: '博士', text: '博士' },
            ],
          }],
        },
      },
      {
        id: 'input_q2',
        type: 'input',
        position: { x: 280, y: 680 },
        data: { label: '儲存學歷', messages: [], inputField: 'education', inputType: 'text' },
      },
      {
        id: 'msg_q3',
        type: 'message',
        position: { x: 280, y: 820 },
        data: {
          label: 'Q3 身高體重',
          messages: [{ type: 'text', text: '4. 你的身高/體重？(例如：175cm/80kg)' }],
        },
      },
      {
        id: 'input_q3',
        type: 'input',
        position: { x: 280, y: 960 },
        data: { label: '儲存身高體重', messages: [], inputField: 'heightWeight', inputType: 'text' },
      },
      {
        id: 'msg_q4',
        type: 'message',
        position: { x: 280, y: 1100 },
        data: {
          label: 'Q4 職業',
          messages: [{ type: 'text', text: '5. 你目前的職業？（例如：資訊工程師）' }],
        },
      },
      {
        id: 'input_q4',
        type: 'input',
        position: { x: 280, y: 1240 },
        data: { label: '儲存職業', messages: [], inputField: 'occupation', inputType: 'text' },
      },
      {
        id: 'msg_q5',
        type: 'message',
        position: { x: 280, y: 1380 },
        data: {
          label: 'Q5 出生月日',
          messages: [{ type: 'text', text: '6. 你是（民國）幾年次的呢？' }],
        },
      },
      {
        id: 'input_q5',
        type: 'input',
        position: { x: 280, y: 1520 },
        data: { label: '儲存出生年次', messages: [], inputField: 'birthYear', inputType: 'text' },
      },
      {
        id: 'msg_confirm',
        type: 'message',
        position: { x: 280, y: 1660 },
        data: {
          label: '結束感謝',
          messages: [{
            type: 'text',
            text: '感謝你 👍 請問你輸入的資訊正確嗎？\n姓名：{{contact.name}}  感情狀態：{{var.maritalStatus}}',
            quickReplies: [
              { label: '資料正確', text: '資料正確' },
              { label: '有錯誤！', text: '有錯誤！' },
            ],
          }],
        },
      },
      {
        id: 'input_confirm',
        type: 'input',
        position: { x: 280, y: 1820 },
        data: { label: '確認回覆', messages: [], inputField: 'dataConfirm', inputType: 'text' },
      },
      {
        id: 'cond_confirm',
        type: 'condition',
        position: { x: 280, y: 1960 },
        data: {
          label: '資料確認分支',
          conditionMode: 'and',
          conditions: [{ field: 'var.dataConfirm', operator: 'equals', value: '資料正確' }],
        },
      },
      {
        id: 'action_tag',
        type: 'action',
        position: { x: 100, y: 2140 },
        data: {
          label: '標記電子書已領取',
          actions: [
            { type: 'addTag', tag: '回答完畢' },
            { type: 'addTag', tag: '脫單攻略' },
          ],
        },
      },
      {
        id: 'msg_correct',
        type: 'message',
        position: { x: 100, y: 2300 },
        data: {
          label: '資料正確回覆',
          messages: [
            {
              type: 'text',
              text: '我們收到了你的脫單分析結果囉！😄\n脫單攻略試開版下載連結：https://supr.link/eEbpe\n憑以下兌換券來活動現場，即可免費兌換完整版脫單攻略電子書及擇友分析乙次。',
            },
            {
              type: 'text',
              text: '我們會有專人與你聯繫，若方便請留下你的電話及聊整時間，感謝 ❤️',
            },
          ],
        },
      },
      {
        id: 'msg_wrong',
        type: 'message',
        position: { x: 460, y: 2140 },
        data: {
          label: '有錯誤回覆',
          messages: [{ type: 'text', text: '再麻煩您回覆正確的資訊喔！例如：姓名錯誤，直接寫下正確姓名即可 ❤️' }],
        },
      },
      {
        id: 'end_1',
        type: 'end',
        position: { x: 280, y: 2500 },
        data: { label: '結束' },
      },
    ],
    edges: [
      { id: 'e1', source: 'trigger_1', target: 'msg_q1' },
      { id: 'e2', source: 'msg_q1', target: 'input_q1' },
      { id: 'e3', source: 'input_q1', target: 'msg_q2' },
      { id: 'e4', source: 'msg_q2', target: 'input_q2' },
      { id: 'e5', source: 'input_q2', target: 'msg_q3' },
      { id: 'e6', source: 'msg_q3', target: 'input_q3' },
      { id: 'e7', source: 'input_q3', target: 'msg_q4' },
      { id: 'e8', source: 'msg_q4', target: 'input_q4' },
      { id: 'e9', source: 'input_q4', target: 'msg_q5' },
      { id: 'e10', source: 'msg_q5', target: 'input_q5' },
      { id: 'e11', source: 'input_q5', target: 'msg_confirm' },
      { id: 'e12', source: 'msg_confirm', target: 'input_confirm' },
      { id: 'e13', source: 'input_confirm', target: 'cond_confirm' },
      { id: 'e14', source: 'cond_confirm', target: 'action_tag', sourceHandle: 'true' },
      { id: 'e15', source: 'cond_confirm', target: 'msg_wrong', sourceHandle: 'false' },
      { id: 'e16', source: 'action_tag', target: 'msg_correct' },
      { id: 'e17', source: 'msg_correct', target: 'end_1' },
      { id: 'e18', source: 'msg_wrong', target: 'end_1' },
    ],
  },

  // ============================================================
  // Survey 3：FB 娜米｜戀愛數字報告問卷（男）
  // ============================================================
  {
    name: 'FB 娜米｜戀愛數字報告問卷（男）',
    description: '戀愛數字報告問卷，收集感情狀態、居住地、學歷、職業、出生月日、身高體重',
    platform: 'all',
    nodes: [
      {
        id: 'trigger_1',
        type: 'trigger',
        position: { x: 50, y: 200 },
        data: {
          label: '觸發器',
          trigger: { type: 'keyword', keywords: ['免費索取戀愛數字報告', '戀愛數字報告'], matchMode: 'contains' },
        },
      },
      {
        id: 'msg_q1',
        type: 'message',
        position: { x: 280, y: 200 },
        data: {
          label: 'Q1 感情狀態',
          messages: [{
            type: 'text',
            text: '1. 請問您目前的感情狀態是？',
            quickReplies: [
              { label: '單身未婚', text: '單身未婚' },
              { label: '離婚', text: '離婚' },
              { label: '單親', text: '單親' },
              { label: '交往中', text: '交往中' },
              { label: '已婚', text: '已婚' },
            ],
          }],
        },
      },
      {
        id: 'input_q1',
        type: 'input',
        position: { x: 280, y: 380 },
        data: { label: '儲存感情狀態', messages: [], inputField: 'maritalStatus', inputType: 'text' },
      },
      {
        id: 'msg_q2',
        type: 'message',
        position: { x: 280, y: 520 },
        data: {
          label: 'Q2 居住地',
          messages: [{ type: 'text', text: '2. 請問你的居住城市？（例如: 台北、台中、台南...）' }],
        },
      },
      {
        id: 'input_q2',
        type: 'input',
        position: { x: 280, y: 660 },
        data: { label: '儲存居住地', messages: [], inputField: 'city', inputType: 'text' },
      },
      {
        id: 'msg_q3',
        type: 'message',
        position: { x: 280, y: 800 },
        data: {
          label: 'Q3 學歷',
          messages: [{
            type: 'text',
            text: '3. 你的最高學歷是？',
            quickReplies: [
              { label: '國中', text: '國中' },
              { label: '高中', text: '高中' },
              { label: '大學', text: '大學' },
              { label: '碩士', text: '碩士' },
              { label: '博士', text: '博士' },
            ],
          }],
        },
      },
      {
        id: 'input_q3',
        type: 'input',
        position: { x: 280, y: 960 },
        data: { label: '儲存學歷', messages: [], inputField: 'education', inputType: 'text' },
      },
      {
        id: 'msg_q4',
        type: 'message',
        position: { x: 280, y: 1100 },
        data: {
          label: 'Q4 職業',
          messages: [{ type: 'text', text: '4. 你目前的職業？（例如：行銷企劃）' }],
        },
      },
      {
        id: 'input_q4',
        type: 'input',
        position: { x: 280, y: 1240 },
        data: { label: '儲存職業', messages: [], inputField: 'occupation', inputType: 'text' },
      },
      {
        id: 'msg_q5',
        type: 'message',
        position: { x: 280, y: 1380 },
        data: {
          label: 'Q5 出生年月日',
          messages: [{ type: 'text', text: '5. 你的出生 年、月、日（例：1997-02-03）' }],
        },
      },
      {
        id: 'input_q5',
        type: 'input',
        position: { x: 280, y: 1520 },
        data: { label: '儲存出生年月日', messages: [], inputField: 'birthday', inputType: 'date' },
      },
      {
        id: 'msg_q6',
        type: 'message',
        position: { x: 280, y: 1660 },
        data: {
          label: 'Q6 身高體重',
          messages: [{ type: 'text', text: '6. 你的身高/體重？(例如：175cm/80kg)' }],
        },
      },
      {
        id: 'input_q6',
        type: 'input',
        position: { x: 280, y: 1800 },
        data: { label: '儲存身高體重', messages: [], inputField: 'heightWeight', inputType: 'text' },
      },
      {
        id: 'msg_confirm',
        type: 'message',
        position: { x: 280, y: 1940 },
        data: {
          label: '結束感謝',
          messages: [{
            type: 'text',
            text: '感謝你 👍 請問你輸入的資訊正確嗎？\n姓名：{{contact.name}}  感情狀態：{{var.maritalStatus}}',
            quickReplies: [
              { label: '資料正確', text: '資料正確' },
              { label: '有錯誤！', text: '有錯誤！' },
            ],
          }],
        },
      },
      {
        id: 'input_confirm',
        type: 'input',
        position: { x: 280, y: 2100 },
        data: { label: '確認回覆', messages: [], inputField: 'dataConfirm', inputType: 'text' },
      },
      {
        id: 'cond_confirm',
        type: 'condition',
        position: { x: 280, y: 2240 },
        data: {
          label: '資料確認分支',
          conditionMode: 'and',
          conditions: [{ field: 'var.dataConfirm', operator: 'equals', value: '資料正確' }],
        },
      },
      {
        id: 'action_tag',
        type: 'action',
        position: { x: 100, y: 2420 },
        data: {
          label: '標記戀愛數字報告',
          actions: [
            { type: 'addTag', tag: '回答完畢' },
            { type: 'addTag', tag: '戀愛數字報告' },
          ],
        },
      },
      {
        id: 'msg_correct',
        type: 'message',
        position: { x: 100, y: 2580 },
        data: {
          label: '資料正確回覆',
          messages: [
            { type: 'text', text: '感謝填寫！我們收到你的資料了，正在為你分析戀愛數字報告 📊' },
            { type: 'text', text: '我們會有專人與你聯繫，若方便請留下你的電話及聯繫時間，感謝 ❤️' },
          ],
        },
      },
      {
        id: 'msg_wrong',
        type: 'message',
        position: { x: 460, y: 2420 },
        data: {
          label: '有錯誤回覆',
          messages: [{ type: 'text', text: '再麻煩您回覆正確的資訊喔！例如：姓名錯誤，直接寫下正確姓名即可 ❤️' }],
        },
      },
      {
        id: 'end_1',
        type: 'end',
        position: { x: 280, y: 2780 },
        data: { label: '結束' },
      },
    ],
    edges: [
      { id: 'e1', source: 'trigger_1', target: 'msg_q1' },
      { id: 'e2', source: 'msg_q1', target: 'input_q1' },
      { id: 'e3', source: 'input_q1', target: 'msg_q2' },
      { id: 'e4', source: 'msg_q2', target: 'input_q2' },
      { id: 'e5', source: 'input_q2', target: 'msg_q3' },
      { id: 'e6', source: 'msg_q3', target: 'input_q3' },
      { id: 'e7', source: 'input_q3', target: 'msg_q4' },
      { id: 'e8', source: 'msg_q4', target: 'input_q4' },
      { id: 'e9', source: 'input_q4', target: 'msg_q5' },
      { id: 'e10', source: 'msg_q5', target: 'input_q5' },
      { id: 'e11', source: 'input_q5', target: 'msg_q6' },
      { id: 'e12', source: 'msg_q6', target: 'input_q6' },
      { id: 'e13', source: 'input_q6', target: 'msg_confirm' },
      { id: 'e14', source: 'msg_confirm', target: 'input_confirm' },
      { id: 'e15', source: 'input_confirm', target: 'cond_confirm' },
      { id: 'e16', source: 'cond_confirm', target: 'action_tag', sourceHandle: 'true' },
      { id: 'e17', source: 'cond_confirm', target: 'msg_wrong', sourceHandle: 'false' },
      { id: 'e18', source: 'action_tag', target: 'msg_correct' },
      { id: 'e19', source: 'msg_correct', target: 'end_1' },
      { id: 'e20', source: 'msg_wrong', target: 'end_1' },
    ],
  },

  // ============================================================
  // Survey 4：FB 娜米｜獲得馬卡的配對問卷
  // ============================================================
  {
    name: 'FB 娜米｜獲得馬卡的配對問卷',
    description: '領取馬卡香水兌換券問卷，收集居住地、出生年次、學歷、身高體重、職業',
    platform: 'all',
    nodes: [
      {
        id: 'trigger_1',
        type: 'trigger',
        position: { x: 50, y: 200 },
        data: {
          label: '觸發器',
          trigger: { type: 'keyword', keywords: ['免費索取', '馬卡', '送馬卡', '立即領取'], matchMode: 'contains' },
        },
      },
      {
        id: 'msg_q1',
        type: 'message',
        position: { x: 280, y: 200 },
        data: {
          label: 'Q1 居住地',
          messages: [{
            type: 'text',
            text: '2. 請選擇你想參加活動的城市',
            quickReplies: [
              { label: '台北', text: '台北' },
              { label: '新竹', text: '新竹' },
              { label: '台中', text: '台中' },
              { label: '台南', text: '台南' },
              { label: '高雄', text: '高雄' },
            ],
          }],
        },
      },
      {
        id: 'input_q1',
        type: 'input',
        position: { x: 280, y: 380 },
        data: { label: '儲存居住地', messages: [], inputField: 'city', inputType: 'text' },
      },
      {
        id: 'msg_q2',
        type: 'message',
        position: { x: 280, y: 520 },
        data: {
          label: 'Q2 出生年次',
          messages: [{ type: 'text', text: '3. 你是民國幾年次的呢？' }],
        },
      },
      {
        id: 'input_q2',
        type: 'input',
        position: { x: 280, y: 660 },
        data: { label: '儲存出生年次', messages: [], inputField: 'birthYear', inputType: 'number' },
      },
      {
        id: 'msg_q3',
        type: 'message',
        position: { x: 280, y: 800 },
        data: {
          label: 'Q3 學歷',
          messages: [{
            type: 'text',
            text: '4. 你的最高學歷是？',
            quickReplies: [
              { label: '國中', text: '國中' },
              { label: '高中', text: '高中' },
              { label: '大學', text: '大學' },
              { label: '碩士', text: '碩士' },
              { label: '博士', text: '博士' },
            ],
          }],
        },
      },
      {
        id: 'input_q3',
        type: 'input',
        position: { x: 280, y: 960 },
        data: { label: '儲存學歷', messages: [], inputField: 'education', inputType: 'text' },
      },
      {
        id: 'msg_q4',
        type: 'message',
        position: { x: 280, y: 1100 },
        data: {
          label: 'Q4 身高體重',
          messages: [{ type: 'text', text: '5. 你的身高/體重？(例如：175cm/80kg)' }],
        },
      },
      {
        id: 'input_q4',
        type: 'input',
        position: { x: 280, y: 1240 },
        data: { label: '儲存身高體重', messages: [], inputField: 'heightWeight', inputType: 'text' },
      },
      {
        id: 'msg_q5',
        type: 'message',
        position: { x: 280, y: 1380 },
        data: {
          label: 'Q5 職業',
          messages: [{ type: 'text', text: '6. 你目前的職業？（例如：資訊工程師）' }],
        },
      },
      {
        id: 'input_q5',
        type: 'input',
        position: { x: 280, y: 1520 },
        data: { label: '儲存職業', messages: [], inputField: 'occupation', inputType: 'text' },
      },
      {
        id: 'msg_confirm',
        type: 'message',
        position: { x: 280, y: 1660 },
        data: {
          label: '結束感謝',
          messages: [{
            type: 'text',
            text: '感謝你 👍 請問你輸入的資訊正確嗎？\n姓名：{{contact.name}}  地區：{{var.city}}',
            quickReplies: [
              { label: '資料正確', text: '資料正確' },
              { label: '有錯誤！', text: '有錯誤！' },
            ],
          }],
        },
      },
      {
        id: 'input_confirm',
        type: 'input',
        position: { x: 280, y: 1820 },
        data: { label: '確認回覆', messages: [], inputField: 'dataConfirm', inputType: 'text' },
      },
      {
        id: 'cond_confirm',
        type: 'condition',
        position: { x: 280, y: 1960 },
        data: {
          label: '資料確認分支',
          conditionMode: 'and',
          conditions: [{ field: 'var.dataConfirm', operator: 'equals', value: '資料正確' }],
        },
      },
      {
        id: 'action_tag',
        type: 'action',
        position: { x: 100, y: 2140 },
        data: {
          label: '標記馬卡已領取',
          actions: [
            { type: 'addTag', tag: '回答完畢' },
            { type: 'addTag', tag: '馬卡兌換券' },
          ],
        },
      },
      {
        id: 'msg_correct',
        type: 'message',
        position: { x: 100, y: 2300 },
        data: {
          label: '資料正確回覆',
          messages: [
            { type: 'text', text: '恭喜你！脫單補給兌換券已為你保留 🎁 請至活動現場兌換馬卡香水。' },
            { type: 'text', text: '我們會有專人與你聯繫，若方便請留下你的電話，感謝 ❤️' },
          ],
        },
      },
      {
        id: 'msg_wrong',
        type: 'message',
        position: { x: 460, y: 2140 },
        data: {
          label: '有錯誤回覆',
          messages: [{ type: 'text', text: '再麻煩您回覆正確的資訊喔！例如：姓名錯誤，直接寫下正確姓名即可 ❤️' }],
        },
      },
      {
        id: 'end_1',
        type: 'end',
        position: { x: 280, y: 2500 },
        data: { label: '結束' },
      },
    ],
    edges: [
      { id: 'e1', source: 'trigger_1', target: 'msg_q1' },
      { id: 'e2', source: 'msg_q1', target: 'input_q1' },
      { id: 'e3', source: 'input_q1', target: 'msg_q2' },
      { id: 'e4', source: 'msg_q2', target: 'input_q2' },
      { id: 'e5', source: 'input_q2', target: 'msg_q3' },
      { id: 'e6', source: 'msg_q3', target: 'input_q3' },
      { id: 'e7', source: 'input_q3', target: 'msg_q4' },
      { id: 'e8', source: 'msg_q4', target: 'input_q4' },
      { id: 'e9', source: 'input_q4', target: 'msg_q5' },
      { id: 'e10', source: 'msg_q5', target: 'input_q5' },
      { id: 'e11', source: 'input_q5', target: 'msg_confirm' },
      { id: 'e12', source: 'msg_confirm', target: 'input_confirm' },
      { id: 'e13', source: 'input_confirm', target: 'cond_confirm' },
      { id: 'e14', source: 'cond_confirm', target: 'action_tag', sourceHandle: 'true' },
      { id: 'e15', source: 'cond_confirm', target: 'msg_wrong', sourceHandle: 'false' },
      { id: 'e16', source: 'action_tag', target: 'msg_correct' },
      { id: 'e17', source: 'msg_correct', target: 'end_1' },
      { id: 'e18', source: 'msg_wrong', target: 'end_1' },
    ],
  },
];

module.exports = TEMPLATES;
