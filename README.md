# DIJKSTRA ACROSS THE UNIVERSE

Interaktywne obserwatorium 3D: 12 000 proceduralnych gwiazd, kilkaset aktywnych systemów, hierarchiczna sieć transportowa i rzeczywisty algorytm Dijkstry. Aplikacja działa lokalnie, bez kluczy API, serwera danych i zewnętrznych assetów graficznych. Wszystkie światy i korytarze są symulacją, nie katalogiem astronomicznym.

## Uruchomienie

Wymagany Node.js 22.13+.

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Otwórz `http://localhost:3000`. Zwykłe odświeżenie generuje nowy seed. Przycisk **SEED** odtwarza wskazany wszechświat.

```sh
npm test              # niezależne testy logiki
npm run typecheck     # kontrola plików TypeScript szablonu i UI primitives
npm run lint          # analiza kodu aplikacji i silnika
npm run test:browser  # testy Playwright przy działającym serwerze :3000
npm run build        # produkcyjny build Vinext / Cloudflare Worker
```

Playwright korzysta z lokalnego Chromium, jeśli istnieje ścieżka skonfigurowana w `playwright.config.js`. Na innym komputerze uruchom `npx playwright install chromium`; konfiguracja automatycznie użyje przeglądarki Playwright. Testy uruchamiają WebGL także z programowym rendererem SwiftShader, więc ich FPS nie są miarą osiągów karty graficznej użytkownika. Bezobsługowy zestaw testów zapisuje zrzuty do `tests/`; raport testów trafia do `tests/browser-results.json`.

## Sterowanie

- **BEGIN DIJKSTRA / PAUSE / RESUME**: uruchomienie i wstrzymanie rzeczywistych obliczeń. Space wykonuje tę samą operację.
- **STEP**: dokładnie jedno zatwierdzenie węzła i relaksacja wszystkich jego niezatwierdzonych sąsiadów. Nie oznacza pojedynczego porównania krawędzi.
- **SPEED**: 0.25×, 0.5×, 1×, 2×, 5×, 20× i WARP. WARP wykonuje maksymalnie 80 zatwierdzeń w jednym takcie, oddając sterowanie przeglądarce pomiędzy partiami.
- **RESET ALGORITHM**: nowy stan obliczeń na tym samym grafie, z tym samym seedem, startem i celem. Zmiana profilu kosztów również resetuje algorytm.
- **NEW UNIVERSE**: nowy seed, położenia gwiazd, ramiona, klastry, graf, wagi, planety i misja. Krótka sekwencja tworzenia nie zawiera animacji udającej wyszukiwanie.
- **REALISTIC / NETWORK**: płynna zmiana ekspozycji warstwy korytarzy.
- **PATHFINDING X-RAY**: wygaszenie tła i nieodkrytej infrastruktury.
- **COST FIELD**: przestrzenne halo wokół odkrytych węzłów. Kolor reprezentuje aktualny koszt; koszt frontier pozostaje tymczasowy. To interpolacja wizualna, nie fizyczne izochrony.
- Przeciągnij scenę, aby orbitować; prawy przycisk / Shift i przeciągnięcie przesuwa kamerę; kółko przybliża. Dotyk: jeden palec obraca, dwa przesuwają i przybliżają.
- Kliknij aktywną gwiazdę, Earth, cel lub pozycję kolejki: profil systemu, koszty, predecessor, kroki odkrycia/zatwierdzenia, planety. **FOCUS SYSTEM** pokazuje uproszczony układ planetarny; **REGIONAL VIEW** jego otoczenie.
- **SET AS START / TARGET** zmienia punkty misji. Przewodnik pod znakiem zapytania przywraca domyślną misję Earth → Earth-like world.
- **G** wraca do galaktyki, **H** ukrywa/pokazuje panele. Przyciski są dostępne z klawiatury.
- **TRAVEL ROUTE** rozpoczyna przelot po rzeczywistych krzywych trasy. Podane są kolejne systemy, przebyta odległość, region i całkowity koszt. **END TRAVEL** przywraca kadr całej trasy.
- Audio jest domyślnie wyłączone. Web Audio tworzy delikatne impulsy zatwierdzeń i akord potwierdzający trasę.

## Stack i architektura

- **React 19 + Vinext + Vite**: interfejs aplikacji na szablonie Sites. Gotowe prymitywy Shadcn / Base UI odpowiadają za przełączniki, zakładki, dostępne dialogi i panel szczegółów.
- **Three.js / WebGL**: własny renderer gwiazd i sieci; OrbitControls steruje kamerą. Brak obrazów tła udających interaktywną scenę.
- `src/simulation/universe.js`: deterministyczny PRNG, struktura galaktyki, planety, spójny graf, profile wag, wybór misji.
- `src/simulation/dijkstra.js`: binarna kolejka priorytetowa i iteracyjny Dijkstra. Nie importuje React ani Three.js.
- `src/simulation/useSimulation.js`: cykl życia, generowanie, odtwarzanie, tempo kroków, rekonstrukcja, synchronizacja renderera i UI, skróty klawiatury, WebMCP.
- `src/simulation/audio.js`: opcjonalny syntezator.
- `src/rendering/Galaxy.js`: bufory GPU, krzywe korytarzy, rekonstrukcja, podróż, kamera, LOD i zwalnianie zasobów.
- `src/rendering/planetMaterial.js`: proceduralny shader powierzchni planet, oświetlenie, lądy, oceany i pasy gazowych olbrzymów.
- `src/ui/Details.jsx`: profil systemu, wynik i manifest trasy, dialog seeda oraz przewodnik.
- `app/page.jsx`: kompozycja obserwatorium i główne kontrolki. `app/globals.css`: wygląd i układ responsywny.

Kod symulacji i sceny jest JavaScriptem ES Modules. `typecheck` sprawdza TypeScript szablonu, nie stanowi dowodu poprawności silnika JS; jego zachowanie weryfikują testy jednostkowe i integracyjne. Każde mutujące działanie interfejsu jest jawne, a UI jest aktualizowane po pełnym kroku/partii, bez stanów częściowo zatwierdzonych.

## Seed i galaktyka

Nowy seed pochodzi z `crypto.getRandomValues`. Ciąg seeda jest mieszany przez FNV-1a, a dalszy strumień generuje PRNG Mulberry32. W obrębie generatora nie ma wywołań `Math.random`. Ten sam seed odtwarza identyczne dane w tej wersji generatora. Zmiana kodu generatora może zmienić wynik — seed nie jest formatem zapisu odpornym na migracje.

Model składa się z 3–5 zakręconych ramion, centralnego zagęszczenia i 25–34 regionów umieszczonych wzdłuż ramion. Rozkład normalny tworzy grubość dysku, nieregularność skupisk i lokalne puste przestrzenie. Każdy region zawiera 18–32 aktywne systemy. Systemy te zajmują miejsca w zbiorze 12 000 gwiazd; ich druga warstwa GPU nadaje im stan algorytmu. Pozostałe gwiazdy służą pokazaniu skali kosmosu i nie uczestniczą w sieci.

Planety powstają z tego samego strumienia PRNG. Każdy aktywny system ma 1–8 uproszczonych światów z temperaturą, promieniem, fazą orbitalną i wynikiem podobieństwa. Sol jest węzłem pierwszego wygenerowanego regionu i ma osiem nazwanych planet, w tym Earth. Położenie Sol pozostaje częścią proceduralnego regionu, a nie sztucznym punktem poza mapą.

## Hierarchiczny graf i spójność

1. Lokalny euclidean minimum spanning tree (Prim) zapewnia połączenie wszystkich systemów regionu.
2. Krótkie połączenia do 2–3 bliskich sąsiadów dodają alternatywy. Niektóre węzły pomijają ten etap, zachowując ślepe odnogi.
3. Wybrane regionalne huby otrzymują dodatkowe korytarze lokalne.
4. MST centrów regionów określa szkielet międzyregionalny. Rzeczywisty most łączy najbliższą parę gwiazd obu regionów. Pojedyncze mosty dają naturalne bottlenecki.
5. Nieliczne dodatkowe mosty i kilka długodystansowych korytarzy między hubami pozwalają powstać skrótom i alternatywnym trasom.

Graf jest nieskierowany. Klucz pary węzłów eliminuje duplikaty i pętle własne. Spójność wynika z konstrukcji, dlatego dowolne punkty sandboxa są osiągalne. Silnik mimo to prawidłowo obsługuje graf niespójny i nieosiągalny cel w testach.

## Wybór celu bez wcześniejszego rozwiązania

Generator wykonuje **BFS, nie Dijkstrę**, wyłącznie do sprawdzenia osiągalności i liczby połączeń bez wag. Preferuje planety z podobieństwem ≥92%, w innym regionie niż Sol, oddalone o minimum 800 umownych lat świetlnych, z 8–40 połączeniami BFS. Spośród nich wybiera najbliższą geometrycznie, z podobieństwem jako rozstrzygnięciem remisu. Istnieje bezpieczny fallback do osiągalnych światów ≥90%, a ostatecznie do poprawnego kandydata w istniejącym systemie.

Ważona trasa nie jest liczona przed naciśnięciem BEGIN lub STEP. Dijkstra może wybrać inną, także dłuższą liczbą połączeń, drogę niż BFS. 8–40 jest preferencją misji, nie wymuszoną długością rozwiązania. W kontrolnej próbce 30 seedów otrzymano 8–44 hopów i 6–100% eksploracji grafu; zróżnicowanie jest wynikiem topologii i wag, nie scenariuszy animacji.

## Wagi

Każda krawędź przechowuje dodatnią długość, bazowy czas, energię, stabilność, ryzyko, interferencję i zatłoczenie. Geometria ma skalę prezentacyjną: 1 jednostka świata = 10 umownych ly.

```text
Fastest = time × (1 + 1.4 × congestion) / stability
Safest  = length × (0.06 + 5 × risk + 2 × (1 − stability))
Energy  = energy × (1 + 2 × interference)
```

Wszystkie wartości są skończone i ściśle dodatnie. Stability mieści się w [0.35, 1), a minimalna długość wynosi 0.01. Korytarze długodystansowe mają korzystniejszy czas bazowy, ale nie muszą być optymalne energetycznie ani pod względem ryzyka. Koszty profili są umownymi jednostkami i nie są bezpośrednio porównywalne między profilami.

## Dijkstra i priority queue

Binarny min-heap działa w O(log n) dla push/pop. Remisy kosztów rozstrzyga ID systemu, dzięki czemu odtwarzanie jest stabilne. Zamiast decrease-key stosowane są nowe wpisy i pomijanie nieaktualnych przy usuwaniu. UI jawnie rozróżnia liczbę odkrytych, niezatwierdzonych węzłów (frontier) od liczby fizycznych wpisów w heapie, która uwzględnia wpisy stare.

Tablice typowane przechowują dystanse, poprzedników, krawędzie poprzedników, status i kroki odkrycia/zatwierdzenia. Jeden `step()` pomija stare wpisy, zatwierdza dokładnie jeden system i relaksuje jego sąsiadów. Każda udana poprawa emituje rzeczywiste zdarzenie do wizualizacji. Settlement celu zatrzymuje wyszukiwanie: nie zatrzymujemy go przy pierwszym odkryciu.

Panel NEXT SYSTEMS pokazuje kilka najtańszych aktualnych kandydatów wraz z poprzednikami. Licznik relaksacji obejmuje sprawdzenia niezatwierdzonych sąsiadów; osobno silnik śledzi udane poprawy. CPU time sumuje rzeczywisty czas `step()`, wykluczając celowe opóźnienia animacji, UI i renderowanie.

Rekonstrukcja jest możliwa dopiero po poprawnym settlement celu. Kolejne krawędzie zapalają się od celu w stronę startu na podstawie `prevEdge`. Końcowy koszt i długość sieci są sumowane z rzeczywistych danych, a procent eksploracji odnosi się do całego osiągalnego grafu (generator gwarantuje spójność). Start równy celowi daje jednowęzłową trasę o koszcie zero.

## Wizualizacja i wydajność

Gwiazdy, pył, węzły oraz impulsy korzystają z batched `Points` i lekkich shaderów. Wszystkie bazowe korytarze są zakrzywionymi krzywymi Béziera, łączonymi w jeden bufor `LineSegments`. Odcinki technicznie są segmentami WebGL, ale ich geometria przedstawia łagodne łuki, nie proste połączenia węzeł–węzeł. Zrekonstruowana trasa otrzymuje osobną geometrię rurki i poświatę; geometrie są scalane, więc cały finał kosztuje dwa dodatkowe draw calle.

Standardowa scena wymaga około 5–8 draw calli (zależnie od warstw), niezależnie od liczby gwiazd. Wielkość punktów zależy od głębokości i ma limit; pixel ratio jest ograniczone do 1.7. Przestrzenne grupowanie w generatorze ogranicza krawędzie, a culling wykonuje GPU. Nie są tworzone tysiące komponentów React ani tysięcy obiektów Mesh. Kolory sieci są aktualizowane po kroku/partii, nie na każdą klatkę. WARP agreguje kroki bez blokowania całej pętli zdarzeń.

Szczegółowe planety i orbity powstają tylko dla wybranego systemu; w tym zbliżeniu nieistotne duże chmury są pomijane, eliminując koszt przezroczystego overdraw. Wymiana wszechświata i zamknięcie widoku jawnie zwalniają geometrie, materiały, OrbitControls, ResizeObserver i etykiety. Kamera płynnie interpoluje położenie i cel; zakończenie wyznacza kadr z bounds faktycznej trasy. Przelot korzysta z tych samych krzywych co sieć.

FPS i liczba draw calli pochodzą z bieżącego renderera. Wydajność zależy od GPU, rozdzielczości i implementacji WebGL; aplikacja nie deklaruje gwarantowanego FPS na każdym urządzeniu. System view jest celowo ilustracyjny, z umowną skalą planet i orbit. Użytkownicy preferujący ograniczony ruch nie otrzymują przejść CSS; eksplorację mogą prowadzić wyłącznie przez STEP.

## Testy i dostęp agentowy

`tests/simulation.test.js` zawiera 14 testów: heap, dodatniość trzech profili, spójność i Earth, deterministyczność wszystkich danych, rzeczywista zmiana topologii, niezależne porównanie z Bellmanem–Fordem, poprawność łańcucha i sumy wag, reset, jeden STEP, równoważność WARP, różne trasy profili, start=cel, cel nieosiągalny i próbka 20 dodatkowych seedów.

`tests/app.spec.js` przechodzi pełną pętlę w prawdziwym Chromium: gotowość bez samoczynnego uruchomienia, krok, pause/resume, warstwy, WARP, rekonstrukcja, travel, reset i identyczne rozwiązanie, wpisywanie seeda, nowe generowanie, zmiana profilu, planety, sandbox oraz mobilny viewport 390px.

Przy dostępnej implementacji `document.modelContext` aplikacja rejestruje trzy narzędzia WebMCP: `read_simulation`, `step_dijkstra` oraz `generate_universe`. Korzystają z tych samych działań co UI i walidują seed. Test kontraktu wykorzystuje implementację rejestru w testowej przeglądarce i sprawdza poprawne wywołania, widoczny rezultat oraz odrzucenie niepoprawnego wejścia. Nie jest to certyfikacja zgodności z konkretną zewnętrzną implementacją proponowanego standardu. Bez WebMCP aplikacja działa normalnie.

## Najważniejsze decyzje projektowe

Kosmos dominuje nad interfejsem; panele można całkowicie ukryć. Kolory mają znaczenie: turkusowy frontier, chłodna pamięć zatwierdzonych obszarów, jasny bieżący węzeł, złota trasa końcowa. Systemy tła dają skalę, a wąska infrastruktura daje zrozumiały graf. Cel wynika z astronomicznie inspirowanych kryteriów misji, podczas gdy droga wynika z kosztów transportu. Ta separacja pozwala zobaczyć, dlaczego bliski świat może wymagać dalekiego i zaskakującego objazdu.
