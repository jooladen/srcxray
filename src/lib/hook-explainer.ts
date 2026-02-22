import type { HookCall } from './parser';

export interface HookExplanation {
  plain: string;
  emoji: string;
  pattern: string;
}

const NAMED_RULES: Record<string, HookExplanation> = {
  useCallback:     { plain: '함수를 캐시해 불필요한 재생성을 방지합니다', emoji: '🗂️', pattern: '성능 최적화' },
  useMemo:         { plain: '복잡한 계산 결과를 캐시합니다', emoji: '🧠', pattern: '성능 최적화' },
  useRef:          { plain: 'DOM 요소를 직접 가리키거나 값을 기억합니다', emoji: '📌', pattern: 'DOM 참조' },
  useContext:      { plain: '전역 상태나 설정값을 가져옵니다', emoji: '🌐', pattern: '전역 상태' },
  useReducer:      { plain: '복잡한 상태 변화를 액션으로 관리합니다', emoji: '🎛️', pattern: '복잡 상태 관리' },
  useId:           { plain: '고유한 ID를 생성합니다 (접근성 용도)', emoji: '🔑', pattern: '고유 ID' },
  useRouter:       { plain: '현재 URL 정보나 페이지 이동 기능을 사용합니다', emoji: '🗺️', pattern: '라우팅' },
  useNavigate:     { plain: '다른 페이지로 이동합니다', emoji: '🧭', pattern: '라우팅' },
  useParams:       { plain: 'URL에서 파라미터를 읽어옵니다', emoji: '🔗', pattern: '라우팅' },
  useSearchParams: { plain: 'URL 쿼리 파라미터를 읽고 씁니다', emoji: '🔍', pattern: 'URL 파라미터' },
  usePathname:     { plain: '현재 URL 경로를 읽어옵니다', emoji: '📍', pattern: '라우팅' },
  useForm:         { plain: '폼 데이터를 관리합니다', emoji: '📝', pattern: '폼 관리' },
  useQuery:        { plain: '서버에서 데이터를 가져와 캐시합니다', emoji: '📡', pattern: '데이터 페칭' },
  useMutation:     { plain: '서버 데이터를 수정하는 작업을 합니다', emoji: '✏️', pattern: '데이터 수정' },
  useInfiniteQuery:{ plain: '무한 스크롤 데이터를 가져옵니다', emoji: '♾️', pattern: '무한 스크롤' },
  useStore:        { plain: '전역 스토어에서 상태를 가져옵니다', emoji: '🏪', pattern: '전역 상태' },
  useSelector:     { plain: 'Redux 스토어에서 값을 선택해 읽습니다', emoji: '🎯', pattern: 'Redux' },
  useDispatch:     { plain: 'Redux 액션을 실행합니다', emoji: '📤', pattern: 'Redux' },
  useTranslation:  { plain: '다국어 번역 텍스트를 가져옵니다', emoji: '🌏', pattern: '국제화(i18n)' },
  useTheme:        { plain: '다크/라이트 테마 정보를 가져옵니다', emoji: '🎨', pattern: '테마' },
};

export function explainUseState(hook: HookCall): HookExplanation {
  const v = hook.stateVar?.toLowerCase() ?? '';

  if (v.match(/^(is|has|show|open|visible|enabled|active|checked|expanded|selected|toggle)/))
    return v.includes('load') || v.includes('ing')
      ? { plain: '데이터를 불러오는 중인지 나타내는 로딩 상태입니다', emoji: '⏳', pattern: '로딩 상태' }
      : { plain: '켜고 끄는 스위치(토글) 상태입니다', emoji: '💡', pattern: '토글/불리언' };

  if (v.match(/loading|fetching|pending/))
    return { plain: '데이터를 불러오는 중인지 나타내는 로딩 상태입니다', emoji: '⏳', pattern: '로딩 상태' };

  if (v.match(/search|query|filter|keyword/))
    return { plain: '검색어나 필터 조건을 저장합니다', emoji: '🔍', pattern: '검색 입력' };

  if (v.match(/name|email|password|phone|address|title|value|text|input|message/))
    return { plain: '사용자가 입력한 텍스트를 저장합니다', emoji: '✏️', pattern: '입력값' };

  if (v.match(/list|items|data|users|posts|products|comments|results|rows|records/))
    return { plain: '목록 데이터를 담는 바구니입니다', emoji: '🧺', pattern: '목록 데이터' };

  if (v.match(/count|index|page|step|total|num|size|offset|current/))
    return { plain: '숫자를 세거나 순서를 기억합니다', emoji: '🔢', pattern: '숫자/카운트' };

  if (v.match(/user|item|product|post|detail|info|selected|current/))
    return { plain: '하나의 객체 데이터를 저장합니다', emoji: '📦', pattern: '객체 데이터' };

  if (v.match(/error|err|message|msg|alert/))
    return { plain: '오류 메시지나 알림 내용을 저장합니다', emoji: '⚠️', pattern: '에러 상태' };

  return { plain: '화면에 보여줄 값을 저장합니다', emoji: '💾', pattern: '상태값' };
}

export function explainUseEffect(hook: HookCall): HookExplanation {
  if (hook.deps === '[]')
    return { plain: '화면이 처음 열릴 때 딱 한 번 실행됩니다 (보통 데이터 로드용)', emoji: '🚀', pattern: '마운트 시 실행' };
  if (!hook.deps)
    return { plain: '매번 렌더링될 때마다 실행됩니다 (주의 필요)', emoji: '🔁', pattern: '항상 실행' };

  const deps = hook.deps.replace(/[\[\]\s]/g, '');
  const depList = deps.split(',').filter(Boolean);
  if (depList.length === 1)
    return { plain: `${depList[0]}가 바뀔 때마다 자동으로 실행됩니다`, emoji: '👀', pattern: '값 변화 감지' };
  return { plain: `[${depList.join(', ')}] 중 하나가 바뀌면 자동으로 실행됩니다`, emoji: '👁️', pattern: '복수 값 감지' };
}

export function getHookExplanation(hook: HookCall): HookExplanation {
  if (hook.name === 'useState')  return explainUseState(hook);
  if (hook.name === 'useEffect') return explainUseEffect(hook);
  if (NAMED_RULES[hook.name])    return NAMED_RULES[hook.name];
  // Custom hook
  return { plain: '프로젝트 내부에서 재사용하는 로직입니다', emoji: '🔧', pattern: '커스텀 훅' };
}
