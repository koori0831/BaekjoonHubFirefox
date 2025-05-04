/**
 * solvedac 문제 데이터를 파싱해오는 함수.
 * @param {int} problemId
 */
async function SolvedApiCall(problemId) {
    try {
        const response = await fetch(`https://solved.ac/api/v3/problem/show?problemId=${problemId}`, { method: 'GET' });
        if (!response.ok) {
            throw new Error(`API 호출 실패: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`SolvedApiCall 에러: ${error.message}`);
        return null; // 기본값 반환
    }
}

console.log('Background script initialized at', new Date().toISOString());

function handleMessage(request, sender, sendResponse) {
    if (request && request.closeWebPage === true && request.isSuccess === true) {
        /* Set username */
        browserAPI.storage.local.set(
            { BaekjoonHub_username: request.username },
        );

        /* Set token */
        browserAPI.storage.local.set(
            { BaekjoonHub_token: request.token },
        );

        /* Close pipe */
        browserAPI.storage.local.set({ pipe_BaekjoonHub: false }, () => {
            console.log('Closed pipe.');
        });

        // 크로스 브라우저 호환 URL 생성
        const extensionId = browserAPI.runtime.id;
        const urlOnboarding = browserAPI.runtime.getURL('welcome.html');

        browserAPI.tabs.create({ url: urlOnboarding, active: true });
    } else if (request && request.closeWebPage === true && request.isSuccess === false) {
        alert('Something went wrong while trying to authenticate your profile!');
        browserAPI.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            browserAPI.tabs.remove(tabs[0].id);
        });
    } else if (request && request.sender === "baekjoon" && request.task === "SolvedApiCall") {
        SolvedApiCall(request.problemId).then((res) => sendResponse(res));
        return true; // Firefox에서 비동기 응답을 위해 true 반환
    }
    return true;
}

// 메시지 리스너에서 handleMessage를 호출
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
    return handleMessage(request, sender, sendResponse);
});
