import type { HookCall } from './parser';

export interface HookExplanation {
  plain: string;
  emoji: string;
  pattern: string;
  analogy?: string;
}

const NAMED_RULES: Record<string, HookExplanation> = {
  useCallback:     { plain: '함수를 캐시해 불필요한 재생성을 방지합니다', emoji: '🗂️', pattern: '성능 최적화', analogy: '메모장 — 함수 레시피를 기억해두고 필요할 때만 꺼내써요' },
  useMemo:         { plain: '복잡한 계산 결과를 캐시합니다', emoji: '🧠', pattern: '성능 최적화', analogy: '계산기 결과 메모 — 같은 계산은 다시 안 해요' },
  useRef:          { plain: 'DOM 요소를 직접 가리키거나 값을 기억합니다', emoji: '📌', pattern: 'DOM 참조', analogy: '포스트잇 — 화면 요소에 직접 붙인 이름표' },
  useContext:      { plain: '전역 상태나 설정값을 가져옵니다', emoji: '🌐', pattern: '전역 상태', analogy: '회사 공용 공지판 — 어디서든 같은 정보를 볼 수 있어요' },
  useReducer:      { plain: '복잡한 상태 변화를 액션으로 관리합니다', emoji: '🎛️', pattern: '복잡 상태 관리', analogy: '리모컨 — 버튼마다 정해진 동작이 있어요' },
  useId:           { plain: '고유한 ID를 생성합니다 (접근성 용도)', emoji: '🔑', pattern: '고유 ID', analogy: '주민번호 — 컴포넌트마다 겹치지 않는 번호' },
  useRouter:       { plain: '현재 URL 정보나 페이지 이동 기능을 사용합니다', emoji: '🗺️', pattern: '라우팅', analogy: '내비게이션 앱 — 지금 어디 있고, 어디로 갈지 알아요' },
  useNavigate:     { plain: '다른 페이지로 이동합니다', emoji: '🧭', pattern: '라우팅', analogy: '엘리베이터 버튼 — 누르면 원하는 층(페이지)으로 이동' },
  useParams:       { plain: 'URL에서 파라미터를 읽어옵니다', emoji: '🔗', pattern: '라우팅', analogy: '주소창에서 번지수 읽기 — /상품/123에서 123을 꺼내요' },
  useSearchParams: { plain: 'URL 쿼리 파라미터를 읽고 씁니다', emoji: '🔍', pattern: 'URL 파라미터', analogy: '검색창 쿼리 읽기 — ?keyword=사과 에서 사과를 꺼내요' },
  usePathname:     { plain: '현재 URL 경로를 읽어옵니다', emoji: '📍', pattern: '라우팅', analogy: '현재 위치 확인 — 지금 어느 페이지인지 알려줘요' },
  useForm:         { plain: '폼 데이터를 관리합니다', emoji: '📝', pattern: '폼 관리', analogy: '입력 양식 비서 — 입력값, 유효성, 제출을 한 번에 관리' },
  useQuery:        { plain: '서버에서 데이터를 가져와 캐시합니다', emoji: '📡', pattern: '데이터 페칭', analogy: '배달 앱 — 주문하면 가져오고, 같은 건 캐시에서 바로 줘요' },
  useMutation:     { plain: '서버 데이터를 수정하는 작업을 합니다', emoji: '✏️', pattern: '데이터 수정', analogy: '편집 모드 — 데이터를 바꾸고 저장하는 버튼' },
  useInfiniteQuery:{ plain: '무한 스크롤 데이터를 가져옵니다', emoji: '♾️', pattern: '무한 스크롤', analogy: '인스타 피드 — 스크롤 내릴 때마다 더 불러와요' },
  useStore:        { plain: '전역 스토어에서 상태를 가져옵니다', emoji: '🏪', pattern: '전역 상태', analogy: '편의점 — 앱 어디서나 필요한 걸 꺼내는 창고' },
  useSelector:     { plain: 'Redux 스토어에서 값을 선택해 읽습니다', emoji: '🎯', pattern: 'Redux', analogy: '창고에서 필요한 물건만 골라오기' },
  useDispatch:     { plain: 'Redux 액션을 실행합니다', emoji: '📤', pattern: 'Redux', analogy: '창고 직원에게 지시서 보내기 — 이렇게 바꿔줘!' },
  useTranslation:  { plain: '다국어 번역 텍스트를 가져옵니다', emoji: '🌏', pattern: '국제화(i18n)', analogy: '번역기 — 언어 설정에 맞는 텍스트를 자동으로 줘요' },
  useTheme:        { plain: '다크/라이트 테마 정보를 가져옵니다', emoji: '🎨', pattern: '테마', analogy: '조명 스위치 — 밝게/어둡게 모드를 읽어와요' },
};

export function explainUseState(hook: HookCall): HookExplanation {
  const v = hook.stateVar?.toLowerCase() ?? '';

  if (v.match(/^(is|has|show|open|visible|enabled|active|checked|expanded|selected|toggle)/))
    return v.includes('load') || v.includes('ing')
      ? { plain: '데이터를 불러오는 중인지 나타내는 로딩 상태입니다', emoji: '⏳', pattern: '로딩 상태', analogy: '모래시계 — 기다리는 중인지 아닌지 표시해요' }
      : { plain: '켜고 끄는 스위치(토글) 상태입니다', emoji: '💡', pattern: '토글/불리언', analogy: '전등 스위치 — 누를 때마다 켜지고 꺼져요' };

  if (v.match(/loading|fetching|pending/))
    return { plain: '데이터를 불러오는 중인지 나타내는 로딩 상태입니다', emoji: '⏳', pattern: '로딩 상태', analogy: '모래시계 — 기다리는 중인지 아닌지 표시해요' };

  if (v.match(/search|query|filter|keyword/))
    return { plain: '검색어나 필터 조건을 저장합니다', emoji: '🔍', pattern: '검색 입력', analogy: '검색창 — 입력한 글자를 기억해요' };

  if (v.match(/name|email|password|phone|address|title|value|text|input|message/))
    return { plain: '사용자가 입력한 텍스트를 저장합니다', emoji: '✏️', pattern: '입력값', analogy: '메모지 — 방금 입력한 내용을 기억해요' };

  if (v.match(/list|items|data|users|posts|products|comments|results|rows|records/))
    return { plain: '목록 데이터를 담는 바구니입니다', emoji: '🧺', pattern: '목록 데이터', analogy: '장바구니 — 여러 아이템을 담아둬요' };

  if (v.match(/count|index|page|step|total|num|size|offset|current/))
    return { plain: '숫자를 세거나 순서를 기억합니다', emoji: '🔢', pattern: '숫자/카운트', analogy: '점수판 — 숫자를 세고 기억해요' };

  if (v.match(/user|item|product|post|detail|info|selected|current/))
    return { plain: '하나의 객체 데이터를 저장합니다', emoji: '📦', pattern: '객체 데이터', analogy: '서랍 — 하나의 물건을 꺼내 쓸 수 있게 보관해요' };

  if (v.match(/error|err|message|msg|alert/))
    return { plain: '오류 메시지나 알림 내용을 저장합니다', emoji: '⚠️', pattern: '에러 상태', analogy: '경고등 — 문제가 생겼을 때 메시지를 기억해요' };

  return { plain: '화면에 보여줄 값을 저장합니다', emoji: '💾', pattern: '상태값', analogy: '화이트보드 — 지우고 다시 쓸 수 있는 값을 기억해요' };
}

export function explainUseEffect(hook: HookCall): HookExplanation {
  if (hook.deps === '[]')
    return { plain: '화면이 처음 열릴 때 딱 한 번 실행됩니다 (보통 데이터 로드용)', emoji: '🚀', pattern: '마운트 시 실행', analogy: '처음 문을 열 때 — 페이지 열리면 딱 한 번 실행' };
  if (!hook.deps)
    return { plain: '매번 렌더링될 때마다 실행됩니다 (주의 필요)', emoji: '🔁', pattern: '항상 실행', analogy: '심장박동 — 매 렌더링마다 계속 실행돼요' };

  const deps = hook.deps.replace(/[\[\]\s]/g, '');
  const depList = deps.split(',').filter(Boolean);
  if (depList.length === 1)
    return { plain: `${depList[0]}가 바뀔 때마다 자동으로 실행됩니다`, emoji: '👀', pattern: '값 변화 감지', analogy: '도어벨 — 누군가 올 때(값이 바뀔 때)만 울려요' };
  return { plain: `[${depList.join(', ')}] 중 하나가 바뀌면 자동으로 실행됩니다`, emoji: '👁️', pattern: '복수 값 감지', analogy: '경보 시스템 — 여러 센서 중 하나라도 감지되면 울려요' };
}

export function getHookExplanation(hook: HookCall): HookExplanation {
  if (hook.name === 'useState')  return explainUseState(hook);
  if (hook.name === 'useEffect') return explainUseEffect(hook);
  if (NAMED_RULES[hook.name])    return NAMED_RULES[hook.name];
  // Custom hook
  return { plain: '프로젝트 내부에서 재사용하는 로직입니다', emoji: '🔧', pattern: '커스텀 훅' };
}
