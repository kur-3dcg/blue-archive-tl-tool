import { createContext, useContext } from 'react';
import type { Character } from '../types';

export type Lang = 'ja' | 'en' | 'cn' | 'tw' | 'ko';

export const LANG_LABELS: Record<Lang, string> = {
  ja: '日本語',
  en: 'English',
  cn: '中文(简)',
  tw: '中文(繁)',
  ko: '한국어',
};

// キー = 日本語テキスト、値 = 各言語訳（'ja' は常にキー自身）
const T: Record<string, Partial<Record<Lang, string>>> = {
  'ブルアカ TL作成支援ツール': { en: 'Blue Academy TL creation support tool', cn: 'Blue Academy TL 创建支持工具', tw: '蔚藍檔案時間軸編輯工具', ko: '부르카 TL 작성 지원 도구' },
  'セーブ': { en: 'save', cn: '保存', tw: '存檔', ko: '세이브' },
  'ロード': { en: 'load', cn: '匯入', tw: '載入', ko: '로드' },
  '共有': { en: 'share', cn: '分享', tw: '分享', ko: '공유' },
  'URL出力': { en: 'URL output', cn: 'URL 输出', tw: '分享鏈接', ko: 'URL 출력' },
  'TL出力': { en: 'TL output', cn: 'TL 输出', tw: '複製文字軸', ko: 'TL 출력' },
  '画像出力（透過）': { en: 'Image output (transparency)', cn: '图像输出（透明度）', tw: '影像輸出（透明度）', ko: '이미지 출력(투과)' },
  '画像出力（白）': { en: 'Image output (white)', cn: '图像输出（白色）', tw: '影像輸出（白色）', ko: '이미지 출력(흰색)' },
  'JSON保存': { en: 'JSON save', cn: 'JSON 保存', tw: 'JSON 保存', ko: 'JSON 저장' },
  'JSONから読込': { en: 'Read from JSON', cn: '从 JSON 读取', tw: '匯入JSON', ko: 'JSON에서 읽기' },
  'テキストからインポート': { en: 'Import from text', cn: '从文本导入', tw: '從文字匯入', ko: '텍스트에서 가져오기' },
  '画像出力（分割）': { en: 'Image output (paged)', cn: '图像输出（分页）', tw: '影像輸出（分頁）', ko: '이미지 출력(분할)' },
  '行/ページ': { en: 'rows/page', cn: '行/页', tw: '行/頁', ko: '행/페이지' },
  'テーマ': { en: 'theme', cn: '主题', tw: '主題', ko: '테마' },
  '言語': { en: 'Language', cn: '语言', tw: '語言', ko: '언어' },
  'ライト': { en: 'Light', cn: '光', tw: '亮', ko: '빛' },
  'ダーク': { en: 'dark', cn: '黒暗的', tw: '暗', ko: '다크' },
  'ブルー': { en: 'blue', cn: '蓝色的', tw: '藍', ko: '블루' },
  '他のツール': { en: 'Other tools', cn: '其他工具', tw: '其他工具', ko: '기타 도구' },
  '他ツール': { en: 'Other Tools', cn: '其他工具', tw: '其他工具', ko: '기타 도구' },
  'マニュアル': { en: 'manual', cn: '手动的', tw: '手動的', ko: '매뉴얼' },
  '使い方・マニュアル（note）': { en: 'How to use/manual (note)', cn: '使用方法/手册（注）', tw: '日文說明手冊 (note)', ko: '사용방법・매뉴얼(note)' },
  'ご意見・ご感想・バグ報告などはこちらから': { en: 'Please submit your opinions, feedback, and bug reports here.', cn: '请在此处提交您的意见、反馈和错误报告。', tw: '請在此提交您的意見、回饋和錯誤報告。', ko: '의견·감상·버그 보고 등은 이쪽으로부터' },
  '更新・開発情報はこちら': { en: 'Update and development information can be found here.', cn: '更新和开发信息请点击此处查看。', tw: '更新和開發資訊請點擊此處查看。', ko: '갱신·개발 정보는 이쪽' },
  'コスト': { en: 'cost', cn: '成本', tw: '費用', ko: '비용' },
  '固有2': { en: 'S2', cn: '独特 2', tw: '專2', ko: '고유 2' },
  '固有4': { en: 'S4', cn: '独特的 4', tw: '專4', ko: '고유 4' },
  'コメント': { en: 'comment', cn: '评论', tw: '註解', ko: '코멘트' },
  'テキスト': { en: 'text', cn: '文本', tw: '文字', ko: '텍스트' },
  'ギミック': { en: 'gimmick', cn: '手法', tw: '關卡機制', ko: '특수 효과' },
  '編成中': { en: 'Under construction', cn: '建设中', tw: '編輯中', ko: '편성 중' },
  'TL作成中': { en: 'Creating a timeline', cn: '创建时间线', tw: '創建時間軸', ko: 'TL 작성 중' },
  'ゲーム再現': { en: 'Game replay', cn: '游戏重现', tw: '遊戲重現', ko: '게임 재현' },
  '（β版）': { en: ' (Beta)', cn: '（测试版）', tw: '（測試版）', ko: ' (베타)' },
  '矢印': { en: 'arrow', cn: '箭', tw: '箭', ko: '화살' },
  'TLクリア': { en: 'Clear TL', cn: '清空TL', tw: '清空TL', ko: 'TL 클리어' },
  'コストスナップ': { en: 'Cost snap', cn: '费用吸附', tw: '費用吸附', ko: '코스트 스냅' },
  '全クリア': { en: 'Completed', cn: '完全的', tw: '重置全部', ko: '모든 클리어' },
  '編成モード': { en: 'Formation Mode', cn: '形成模式', tw: '編輯模式', ko: '편성 모드' },
  '通常': { en: 'usually', cn: '通常', tw: '一般模式', ko: '보통' },
  '制約解除決戦': { en: 'The decisive battle to remove the constraints', cn: '解除限制的决定性战役', tw: '制約解除決戰', ko: '제약 해제 결전' },
  'スキルスロット': { en: 'Skill Slots', cn: '技能槽', tw: '技能槽', ko: '스킬 슬롯' },
  '生徒を選択': { en: 'Select', cn: '选择学生', tw: '選擇學生', ko: '학생 선택' },
  '解除': { en: 'Remove', cn: '解除', tw: '解除', ko: '해제' },
  '生徒名で検索...': { en: 'Search...', cn: '搜索...', tw: '搜尋...', ko: '이름으로 검색...' },
  '該当なし': { en: 'No results', cn: '无结果', tw: '無結果', ko: '결과 없음' },
  // Timeline
  'クリック: 選択': { en: 'Click: Select', cn: '点击：选择', tw: '點選：選擇', ko: '클릭: 선택' },
  'ダブルクリック: フリーコメント': { en: 'Double-click: Free comment', cn: '双击：自由评论', tw: '按兩下：自由評論', ko: '더블 클릭: 무료 코멘트' },
  '右クリック: 削除': { en: 'Right-click: Delete', cn: '右键单击：删除', tw: '右鍵：刪除', ko: '오른쪽 클릭: 삭제' },
  'ドラッグ: 移動': { en: 'Drag: Move', cn: '拖动：移动', tw: '拖曳：移動', ko: '드래그: 이동' },
  'Shift+クリック: EX対象': { en: 'Shift+Click: EX Target', cn: 'Shift+单击：EX目标', tw: 'Shift+點擊：EX目標', ko: 'Shift+클릭: EX 대상' },
  'Ctrl+クリック: コメント': { en: 'Ctrl+click: Comment', cn: 'Ctrl+点击：评论', tw: 'Ctrl+點選：評論', ko: 'Ctrl+클릭: 코멘트' },
  'Alt+クリック: 矢印': { en: 'Alt+click: Arrow', cn: 'Alt+点击：箭头', tw: 'Alt+點選：箭頭', ko: 'Alt+클릭: 화살' },
  '時間': { en: 'time', cn: '时间', tw: '關卡時長', ko: '시간' },
  'スナップ': { en: 'snap', cn: '折断', tw: '時間格', ko: '스냅' },
  '0.1秒': { en: '0.1s', cn: '0.1秒', tw: '0.1秒', ko: '0.1초' },
  '🔓移動可能': { en: '🔓Moveable', cn: '🔓可移动', tw: '🔓可移動', ko: '🔓 이동 가능' },
  '🔒移動禁止': { en: '🔒No movement allowed', cn: '🔒禁止移动', tw: '🔒禁止移動', ko: '🔒 이동 금지' },
  'スキル順': { en: 'Skill order', cn: '技能顺序', tw: '技能順序', ko: '스킬순' },
  'レイヤー': { en: 'Layer', cn: '层', tw: '層', ko: '레이어' },
  '目標': { en: 'the goal', cn: '目标', tw: '目標', ko: '목표' },
  'コピー': { en: 'copy', cn: '复制', tw: '複製', ko: '복사' },
  // StageGimmick
  'プリセット': { en: 'Preset', cn: '预设', tw: '預設', ko: '프리셋' },
  'カスタム': { en: 'Custom', cn: '自定义', tw: '自定義', ko: '커스텀' },
  '名前': { en: 'Name', cn: '名称', tw: '名稱', ko: '이름' },
  '回復力+': { en: 'Recovery+', cn: '回复力+', tw: '回復力+', ko: '회복력+' },
  '落とし': { en: ' down', cn: '倒下', tw: '倒下', ko: ' 탈락' },
  '落とし生徒': { en: 'Downed students', cn: '倒下学生', tw: '倒下學生', ko: '탈락 학생' },
  '落ちる時間': { en: 'Down at', cn: '倒下时间', tw: '倒下時間', ko: '탈락 시간' },
  '落ちた時刻からその生徒のコスト回復力（700・SS）を除外します': { en: 'Removes the student\'s cost recovery (700 + SS) from that time on', cn: '从该时刻起扣除该学生的费用回复力（700・SS）', tw: '從該時刻起扣除該學生的費用回復力（700・SS）', ko: '해당 시점부터 그 학생의 코스트 회복력(700・SS)을 제외합니다' },
  '時間は M:SS または M:SS.000 形式で入力してください': { en: 'Enter time as M:SS or M:SS.000', cn: '请以 M:SS 或 M:SS.000 格式输入时间', tw: '請以 M:SS 或 M:SS.000 格式輸入時間', ko: '시간은 M:SS 또는 M:SS.000 형식으로 입력하세요' },
  '効果時間（秒）を正の数で入力してください': { en: 'Enter a positive duration (s)', cn: '请输入正数的持续时间（秒）', tw: '請輸入正數的持續時間（秒）', ko: '지속시간(초)을 양수로 입력하세요' },
  '回復速度%を入力してください': { en: 'Enter recovery %', cn: '请输入回复速度%', tw: '請輸入回復速度%', ko: '회복 속도%를 입력하세요' },
  '回復力を正の数で入力してください': { en: 'Enter a positive recovery value', cn: '请输入正数的回复力', tw: '請輸入正數的回復力', ko: '회복력을 양수로 입력하세요' },
  '生徒が編成されていないため追加できません': { en: 'Cannot add: no students in formation', cn: '未编成学生，无法添加', tw: '未編成學生，無法新增', ko: '학생이 편성되지 않아 추가할 수 없습니다' },
  '戦闘時間内で入力してください': { en: 'Enter a time within the battle', cn: '请输入战斗时间内的时间', tw: '請輸入戰鬥時間內的時間', ko: '전투 시간 내로 입력하세요' },
  'ストライカーが編成されていません': { en: 'No strikers in formation', cn: '未编成前排', tw: '未編成前排', ko: '스트라이커가 편성되지 않았습니다' },
  '全ストライカーが設定済みです': { en: 'All strikers already set', cn: '所有前排均已设置', tw: '所有前排均已設定', ko: '모든 스트라이커가 설정되었습니다' },
  '中クリック+ドラッグ': { en: 'Middle-click + drag', cn: '中键+拖动', tw: '中鍵+拖曳', ko: '휠 클릭+드래그' },
  'TLをつかんで移動': { en: 'Grab and pan the TL', cn: '抓取并移动TL', tw: '抓取並移動TL', ko: 'TL을 잡고 이동' },
  '開始時コスト': { en: 'Start cost', cn: '初始费用', tw: '初始費用', ko: '시작 코스트' },
  '種類': { en: 'Type', cn: '类型', tw: '類型', ko: '종류' },
  '加算': { en: 'Flat', cn: '加算', tw: '加算', ko: '가산' },
  '乗算': { en: 'Percent', cn: '乘算', tw: '乘算', ko: '승산' },
  '固定': { en: 'Fixed', cn: '固定', tw: '固定', ko: '고정' },
  'コスト+': { en: 'Cost+', cn: '费用+', tw: '費用+', ko: '코스트+' },
  '獲得コストを入力してください': { en: 'Enter the cost to gain', cn: '请输入获得的费用', tw: '請輸入獲得的費用', ko: '획득 코스트를 입력하세요' },
  '回復速度%': { en: 'Recovery%', cn: '回复速度%', tw: '回復速度%', ko: '회복 속도%' },
  '常時（戦闘開始〜終了）': { en: 'Always (whole battle)', cn: '常驻（战斗全程）', tw: '常駐（戰鬥全程）', ko: '상시 (전투 전체)' },
  '効果時間(秒)': { en: 'Duration(s)', cn: '持续时间(秒)', tw: '持續時間(秒)', ko: '지속시간(초)' },
  '発動時間': { en: 'Trigger time', cn: '触发时间', tw: '觸發時間', ko: '발동 시간' },
  '追加': { en: 'Add', cn: '添加', tw: '添加', ko: '추가' },
  '削除': { en: 'Delete', cn: '删除', tw: '刪除', ko: '삭제' },
  'ステージギミック': { en: 'Stage Gimmick', cn: '关卡机制', tw: '關卡機制', ko: '스테이지 기믹' },
  // Timeline modal
  'コメントを入力': { en: 'Enter comment', cn: '输入评论', tw: '輸入評論', ko: '코멘트 입력' },
  'コメント（空欄で削除）': { en: 'Comment (empty to delete)', cn: '评论（空则删除）', tw: '評論（空則刪除）', ko: '코멘트（빈칸이면 삭제）' },
  // SaveLoad
  'セーブ名...': { en: 'Save name...', cn: '保存名称...', tw: '儲存名稱...', ko: '저장 이름...' },
  '空きスロット': { en: 'Empty slot', cn: '空槽', tw: '空槽', ko: '빈 슬롯' },
  'データなし': { en: 'No data', cn: '无数据', tw: '無資料', ko: '데이터 없음' },
  '上書き': { en: 'Overwrite', cn: '覆盖', tw: '覆蓋', ko: '덮어쓰기' },
  'キャンセル': { en: 'Cancel', cn: '取消', tw: '取消', ko: '취소' },
  'OK': { en: 'OK', cn: 'OK', tw: 'OK', ko: 'OK' },
};

export const LanguageContext = createContext<Lang>('ja');

/** UI文字列を翻訳する hook。キーが見つからなければキー自身を返す */
export function useT(): (key: string) => string {
  const lang = useContext(LanguageContext);
  return (key: string) => {
    if (lang === 'ja') return key;
    return T[key]?.[lang] ?? key;
  };
}

/** キャラ名を現在の言語で返す hook */
export function useCharName(): (char: Character | null) => string {
  const lang = useContext(LanguageContext);
  return (char: Character | null) => {
    if (!char) return '';
    return getCharName(char, lang);
  };
}

/** キャラ名を指定言語で返すユーティリティ */
export function getCharName(char: Character, lang: Lang): string {
  switch (lang) {
    case 'en': return char.nameEn ?? char.name;
    case 'ko': return char.nameKr ?? char.name;
    case 'tw': return char.nameTw ?? char.name;
    case 'cn': return char.nameCn ?? char.name;
    default:   return char.name;
  }
}
