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
  '画像出力（分割）': { en: 'Image output (paged)', cn: '图像输出（分页）', tw: '影像輸出（分頁）', ko: '이미지 출력(분할)' },
  '行/ページ': { en: 'rows/page', cn: '行/页', tw: '行/頁', ko: '행/페이지' },
  'テーマ': { en: 'theme', cn: '主题', tw: '主題', ko: '테마' },
  '言語': { en: 'Language', cn: '语言', tw: '語言', ko: '언어' },
  'ライト': { en: 'Light', cn: '光', tw: '亮', ko: '빛' },
  'ダーク': { en: 'dark', cn: '黒暗的', tw: '暗', ko: '다크' },
  'ブルー': { en: 'blue', cn: '蓝色的', tw: '藍', ko: '블루' },
  '他のツール': { en: 'Other tools', cn: '其他工具', tw: '其他工具', ko: '기타 도구' },
  '戦術対抗戦編成記録ツール': { en: 'Tactical Battle Formation Recording Tool', cn: '战术战斗队形记录工具', tw: 'PVP隊伍編輯工具', ko: '전술 대항전 편성 기록 툴' },
  '家具シミュレーションツール': { en: 'Furniture simulation tool', cn: '家具模拟工具', tw: '家具配置模擬工具', ko: '가구 시뮬레이션 도구' },
  '石割収支管理ツール': { en: 'Stone splitting revenue and expenditure management tool', cn: '石头劈裂收入和支出管理工具', tw: '石頭劈裂收入與支出管理工具', ko: '석할수지 관리 도구' },
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
  'ゲーム再現': { en: 'Game recreation', cn: '游戏娱乐', tw: '遊戲娛樂', ko: '게임 재현' },
  '矢印': { en: 'arrow', cn: '箭', tw: '箭', ko: '화살' },
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
  '1秒': { en: '1 second', cn: '1秒', tw: '1秒', ko: '1초' },
  '0.1秒': { en: '0.1 seconds', cn: '0.1秒', tw: '0.1秒', ko: '0.1초' },
  '🔓移動可': { en: '🔓Moveable', cn: '🔓可移动', tw: '🔓可移動', ko: '🔓 이동 가능' },
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
