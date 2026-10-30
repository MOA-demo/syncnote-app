import type { TagColor } from '../../editor/tags'

export interface Attachment { name: string; size: number; type: string; previewUrl?: string }
export interface Note {
  id: string; title: string; body: string; tags: { name: string; color?: TagColor }[]; attachments: Attachment[]
  updatedAt: number; version: number; baseVersion: number; syncedAt?: number
}

const KEY = 'syncnote.notes'
const meeting = `# 주간 회의록

11월 3일 화요일 · 제품팀 정기 회의
참석: 지민, 서준, 하늘, 유진

## 이번 주 이야기
지난주에 모은 사용자 의견을 함께 살펴보았습니다. 이동 중 휴대폰으로 적은 생각을 사무실의 큰 화면에서 자연스럽게 이어 쓰고 싶다는 의견이 많았습니다. 노트를 여는 순간부터 마지막 문장을 저장하는 순간까지, 사용자가 안심할 수 있는 흐름을 만드는 데 집중하기로 했습니다.

## 주요 안건
- 노트를 빠르게 편집할 때 저장 상태가 어떻게 보이는지 확인합니다. 연결이 잠시 끊겨도 작성한 내용은 기기에 남아 있어야 합니다.
- 출장 중 사용할 체크리스트와 회의록 양식을 정리합니다. 제목과 태그만으로 필요한 내용을 쉽게 찾을 수 있도록 이름을 통일합니다.
- 새 팀원이 처음 들어왔을 때 노트 작성, 첨부, 검색을 차례로 경험할 수 있도록 안내 문구를 다듬습니다.

## 결정 사항
이번 주에는 새로운 기능을 늘리기보다 자주 사용하는 작성 흐름을 점검합니다. 문의로 접수된 불편은 발생 환경과 오류 코드를 함께 기록하고, 같은 상황을 재현한 뒤 원인을 확인합니다. 요금제와 환불 정책의 안내도 실제 설정 값과 일치하는지 검토합니다.

## 다음 할 일
- [ ] 지민: 사용자 의견을 주제별로 정리하고 다음 회의 전에 공유하기
- [ ] 서준: 긴 회의록을 여러 번 수정하는 저장 흐름 확인하기
- [ ] 하늘: 모바일과 데스크톱에서 첨부 미리보기 확인하기
- [ ] 유진: 고객지원 안내와 요금제 문구 검토하기

다음 회의는 금요일 오전에 진행합니다. 각자 확인한 내용은 이 노트에 덧붙여 주세요.`

export function createNote(): Note {
  return { id: crypto.randomUUID(), title: '제목 없는 노트', body: '', tags: [], attachments: [], updatedAt: Date.now(), version: 1, baseVersion: 1 }
}

function sampleNotes(): Note[] {
  const now = Date.now()
  return [
    { ...createNote(), title: '주간 회의록 (11/3)', body: meeting, tags: [{ name: '업무' }, { name: '회의' }], updatedAt: now },
    { ...createNote(), title: '출장 준비물', body: '# 출장 준비물\n\n가볍게 떠나고, 빠짐없이 챙기기.\n\n- [ ] 노트북과 충전기\n- [ ] 신분증과 교통편 예약 확인\n- [ ] 발표 자료와 회의 안건\n- [ ] 명함과 필기구\n- [x] 숙소 예약 확인', tags: [{ name: '체크리스트' }], updatedAt: now - 3_600_000 },
    { ...createNote(), title: '아이디어 메모', body: '# 작은 생각을 모으는 곳\n\n아침 산책 중 떠오른 생각.\n\n- 하루의 끝에 기억하고 싶은 문장 하나 남기기\n- 다음 여행에서 보고 싶은 장소 모으기\n- 바쁜 날에도 생각을 놓치지 않도록 짧게 기록하기\n\n**완벽하게 정리하지 않아도 괜찮아요.** 일단 적어 두면 다음 생각이 이어집니다.', tags: [{ name: '아이디어' }, { name: '일상' }], updatedAt: now - 86_400_000 },
  ]
}

export function loadNotes(): Note[] {
  const raw = localStorage.getItem(KEY)
  if (raw) {
    try {
      const notes: unknown = JSON.parse(raw)
      if (Array.isArray(notes) && notes.every((note) => note && typeof note.id === 'string' && typeof note.body === 'string')) {
        const storedNotes = notes as (Omit<Note, 'tags'> & { tags: (string | Note['tags'][number])[] })[]
        let changed = false
        const migrated = storedNotes.map((note): Note => ({
          ...note,
          tags: note.tags.map((tag) => {
            if (typeof tag !== 'string') return tag
            changed = true
            return { name: tag }
          }),
        }))
        if (changed) saveNotesLocal(migrated)
        return migrated
      }
    } catch { /* 읽을 수 없는 데이터는 초기 노트로 복구 */ }
  }
  const notes = sampleNotes()
  saveNotesLocal(notes)
  return notes
}

export function saveNotesLocal(notes: Note[]): void {
  localStorage.setItem(KEY, JSON.stringify(notes.map((note) => ({ ...note, attachments: note.attachments.map(({ name, size, type }) => ({ name, size, type })) }))))
}

export function deleteNote(id: string): void { saveNotesLocal(loadNotes().filter((note) => note.id !== id)) }
