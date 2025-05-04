const option = () => {
    return $('#type').val();
};

const repositoryName = () => {
    // 링크 옵션일 경우 드롭다운에서 값을 가져옴
    if (option() === 'link') {
        return $('#repo-dropdown').val();
    }
    // 새 리포지토리 생성 옵션일 경우 텍스트 입력에서 값을 가져옴
    return $('#name').val().trim();
};

// 페이지 로드 시 실행될 코드
$(document).ready(function () {
    // 초기 상태 설정: 입력 필드 비활성화
    $('#name').prop('disabled', true);

    // 기존 repo-input-container가 이미 표시되어 있으므로 스타일만 조정
    $('#repo-input-container').addClass('disabled');
});

// 타입 선택 이벤트 핸들러 수정
$('#type').on('change', function () {
    const valueSelected = this.value;
    if (valueSelected) {
        $('#hook_button').attr('disabled', false);

        // 선택에 따라 입력 필드와 드롭다운 전환
        if (valueSelected === 'link') {
            // 링크 옵션 선택 시 드롭다운 표시, 입력 필드 숨김
            $('#repo-input-container').hide();
            $('#name').prop('disabled', true);
            $('#repo-dropdown-container').show();
            // 리포지토리 목록 로드
            loadRepositories();
        } else if (valueSelected === 'new') {
            // 새 리포지토리 생성 옵션 선택 시 입력 필드 표시, 드롭다운 숨김
            $('#repo-dropdown-container').hide();
            $('#repo-input-container').show().removeClass('disabled');
            $('#name').prop('disabled', false);
        }
    } else {
        // 옵션이 선택되지 않은 경우 (Pick an Option)
        $('#hook_button').attr('disabled', true);
        $('#name').prop('disabled', true);
        $('#repo-input-container').addClass('disabled');
        $('#repo-dropdown-container').hide();
    }
});

/* Status codes for creating of repo */

const statusCode = (res, status, name) => {
    switch (status) {
        case 304:
            $('#success').hide();
            $('#error').text(`Error creating ${name} - Unable to modify repository. Try again later!`);
            $('#error').show();
            break;

        case 400:
            $('#success').hide();
            $('#error').text(`Error creating ${name} - Bad POST request, make sure you're not overriding any existing scripts`);
            $('#error').show();
            break;

        case 401:
            $('#success').hide();
            $('#error').text(`Error creating ${name} - Unauthorized access to repo. Try again later!`);
            $('#error').show();
            break;

        case 403:
            $('#success').hide();
            $('#error').text(`Error creating ${name} - Forbidden access to repository. Try again later!`);
            $('#error').show();
            break;

        case 422:
            $('#success').hide();
            $('#error').text(`Error creating ${name} - Unprocessable Entity. Repository may have already been created. Try Linking instead (select 2nd option).`);
            $('#error').show();
            break;

        default:
            /* Change mode type to commit */
            browserAPI.storage.local.set({ mode_type: 'commit' }, () => {
                $('#error').hide();
                $('#success').html(`Successfully created <a target="blank" href="${res.html_url}">${name}</a>. Start <a href="https://www.acmicpc.net/">BOJ</a>!`);
                $('#success').show();
                $('#unlink').show();
                /* Show new layout */
                document.getElementById('hook_mode').style.display = 'none';
                document.getElementById('commit_mode').style.display = 'inherit';
            });
            /* Set Repo Hook */
            browserAPI.storage.local.set({ BaekjoonHub_hook: res.full_name }, () => {
                console.log('Successfully set new repo hook');
            });

            break;
    }
};

const createRepo = (token, name) => {
    const AUTHENTICATION_URL = 'https://api.github.com/user/repos';
    let data = {
        name,
        private: true,
        auto_init: true,
        description: 'This is an auto push repository for Baekjoon Online Judge created with [BaekjoonHub](https://github.com/BaekjoonHub/BaekjoonHub).',
    };
    data = JSON.stringify(data);

    const xhr = new XMLHttpRequest();
    xhr.addEventListener('readystatechange', function () {
        if (xhr.readyState === 4) {
            statusCode(JSON.parse(xhr.responseText), xhr.status, name);
        }
    });

    stats = {};
    stats.version = browserAPI.runtime.getManifest().version;
    stats.submission = {};
    browserAPI.storage.local.set({ stats });

    xhr.open('POST', AUTHENTICATION_URL, true);
    xhr.setRequestHeader('Authorization', `token ${token}`);
    xhr.setRequestHeader('Accept', 'application/vnd.github.v3+json');
    xhr.send(data);
};

/* Status codes for linking of repo */
const linkStatusCode = (status, name) => {
    let bool = false;
    switch (status) {
        case 301:
            $('#success').hide();
            $('#error').html(`Error linking <a target="blank" href="${`https://github.com/${name}`}">${name}</a> to BaekjoonHub. <br> This repository has been moved permenantly. Try creating a new one.`);
            $('#error').show();
            break;

        case 403:
            $('#success').hide();
            $('#error').html(`Error linking <a target="blank" href="${`https://github.com/${name}`}">${name}</a> to BaekjoonHub. <br> Forbidden action. Please make sure you have the right access to this repository.`);
            $('#error').show();
            break;

        case 404:
            $('#success').hide();
            $('#error').html(`Error linking <a target="blank" href="${`https://github.com/${name}`}">${name}</a> to BaekjoonHub. <br> Resource not found. Make sure you enter the right repository name.`);
            $('#error').show();
            break;

        default:
            bool = true;
            break;
    }
    $('#unlink').show();
    return bool;
};

/* 
    Method for linking hook with an existing repository 
    Steps:
    1. Check if existing repository exists and the user has write access to it.
    2. Link Hook to it (chrome Storage).
*/
const linkRepo = (token, name) => {
    const AUTHENTICATION_URL = `https://api.github.com/repos/${name}`;

    const xhr = new XMLHttpRequest();
    xhr.addEventListener('readystatechange', function () {
        if (xhr.readyState === 4) {
            const res = JSON.parse(xhr.responseText);
            const bool = linkStatusCode(xhr.status, name);
            if (xhr.status === 200) {
                // BUG FIX
                if (!bool) {
                    // unable to gain access to repo in commit mode. Must switch to hook mode.
                    /* Set mode type to hook */
                    browserAPI.storage.local.set({ mode_type: 'hook' }, () => {
                        console.log(`Error linking ${name} to BaekjoonHub`);
                    });
                    /* Set Repo Hook to NONE */
                    browserAPI.storage.local.set({ BaekjoonHub_hook: null }, () => {
                        console.log('Defaulted repo hook to NONE');
                    });

                    /* Hide accordingly */
                    document.getElementById('hook_mode').style.display = 'inherit';
                    document.getElementById('commit_mode').style.display = 'none';
                } else {
                    /* Change mode type to commit */
                    /* Save repo url to chrome storage */
                    browserAPI.storage.local.set({ mode_type: 'commit', repo: res.html_url }, () => {
                        $('#error').hide();
                        $('#success').html(`Successfully linked <a target="blank" href="${res.html_url}">${name}</a> to BaekjoonHub. Start <a href="https://www.acmicpc.net/">BOJ</a> now!`);
                        $('#success').show();
                        $('#unlink').show();
                    });
                    /* Set Repo Hook */

                    stats = {};
                    stats.version = browserAPI.runtime.getManifest().version;
                    stats.submission = {};
                    browserAPI.storage.local.set({ stats });

                    browserAPI.storage.local.set({ BaekjoonHub_hook: res.full_name }, () => {
                        console.log('Successfully set new repo hook');
                        /* Get problems solved count */
                        browserAPI.storage.local.get('stats', (psolved) => {
                            const { stats } = psolved;
                        });
                    });
                    /* Hide accordingly */
                    document.getElementById('hook_mode').style.display = 'none';
                    document.getElementById('commit_mode').style.display = 'inherit';
                }
            }
        }
    });

    xhr.open('GET', AUTHENTICATION_URL, true);
    xhr.setRequestHeader('Authorization', `token ${token}`);
    xhr.setRequestHeader('Accept', 'application/vnd.github.v3+json');
    xhr.send();
};

const unlinkRepo = () => {
    /* Set mode type to hook */
    browserAPI.storage.local.set({ mode_type: 'hook' }, () => {
        console.log(`Unlinking repo`);
    });
    /* Set Repo Hook to NONE */
    browserAPI.storage.local.set({ BaekjoonHub_hook: null }, () => {
        console.log('Defaulted repo hook to NONE');
    });

    /*프로그래밍 언어별 폴더 정리 옵션 세션 저장 초기화*/
    browserAPI.storage.local.set({ BaekjoonHub_disOption: "platform" }, () => {
        console.log('DisOption Reset');
    });

    /* Hide accordingly */
    document.getElementById('hook_mode').style.display = 'inherit';
    document.getElementById('commit_mode').style.display = 'none';
};

// 리포지토리 드롭다운 목록을 로드하는 함수
const loadRepositories = () => {
    $('#repo-dropdown').empty().append('<option value="">Loading repositories...</option>');

    browserAPI.storage.local.get(['BaekjoonHub_token', 'BaekjoonHub_username'], (data) => {
        const token = data.BaekjoonHub_token;
        if (!token) {
            $('#repo-dropdown').empty().append('<option value="">Token not found</option>');
            return;
        }

        // GitHub API를 사용하여 사용자 리포지토리 가져오기
        fetch('https://api.github.com/user/repos?visibility=all&sort=updated&per_page=100', {
            method: 'GET',
            headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
        })
            .then(res => res.json())
            .then(repos => {
                $('#repo-dropdown').empty().append('<option value="">Select Repository</option>');

                repos.forEach(repo => {
                    $('#repo-dropdown').append(`<option value="${repo.name}">${repo.full_name}</option>`);
                });
            })
            .catch(error => {
                console.error('Error fetching repositories:', error);
                $('#repo-dropdown').empty().append('<option value="">Failed to load repositories</option>');
            });
    });
};

/* Check for value of select tag, Get Started disabled by default */

$('#type').on('change', function () {
    const valueSelected = this.value;
    if (valueSelected) {
        $('#hook_button').attr('disabled', false);

        // 선택에 따라 입력 필드와 드롭다운 전환
        if (valueSelected === 'link') {
            // 링크 옵션 선택 시 드롭다운 표시
            $('#repo-input-container').hide();
            $('#repo-dropdown-container').show();
            // 리포지토리 목록 로드
            loadRepositories();
        } else {
            // 새 리포지토리 생성 옵션 선택 시 입력 필드 표시
            $('#repo-dropdown-container').hide();
            $('#repo-input-container').show();
        }
    } else {
        $('#hook_button').attr('disabled', true);
        // 옵션을 선택하지 않은 경우 모두 숨김
        $('#repo-dropdown-container').hide();
        $('#repo-input-container').hide();
    }
});

// 드롭다운 선택 시 버튼 활성화
$('#repo-dropdown').on('change', function () {
    if ($(this).val()) {
        $('#hook_button').attr('disabled', false);
    } else {
        $('#hook_button').attr('disabled', true);
    }
});

$('#hook_button').on('click', () => {
    /* on click should generate: 1) option 2) repository name */
    if (!option()) {
        $('#error').text('No option selected - Pick an option from dropdown menu below that best suits you!');
        $('#error').show();
    } else if (!repositoryName()) {
        $('#error').text('No repository name added - Enter the name of your repository!');
        if (option() === 'new') {
            $('#name').focus();
        }
        $('#error').show();
    } else {
        $('#error').hide();
        $('#success').text('Attempting to create Hook... Please wait.');
        $('#success').show();

        /* 
          Perform processing
          - step 1: Check if current stage === hook.
          - step 2: store repo name as repoName in chrome storage.
          - step 3: if (1), POST request to repoName (iff option = create new repo) ; else display error message.
          - step 4: if proceed from 3, hide hook_mode and display commit_mode (show stats e.g: files pushed/questions-solved/leaderboard)
        */
        browserAPI.storage.local.get('BaekjoonHub_token', (data) => {
            const token = data.BaekjoonHub_token;
            if (token === null || token === undefined) {
                /* Not authorized yet. */
                $('#error').text('Authorization error - Grant BaekjoonHub access to your GitHub account to continue (launch extension to proceed)');
                $('#error').show();
                $('#success').hide();
            } else if (option() === 'new') {
                createRepo(token, repositoryName());
            } else {
                browserAPI.storage.local.get('BaekjoonHub_username', (data2) => {
                    const username = data2.BaekjoonHub_username;
                    if (!username) {
                        /* Improper authorization. */
                        $('#error').text('Improper Authorization error - Grant BaekjoonHub access to your GitHub account to continue (launch extension to proceed)');
                        $('#error').show();
                        $('#success').hide();
                    } else {
                        linkRepo(token, `${username}/${repositoryName()}`, false);
                    }
                });
            }
        });
    }

    /*프로그래밍 언어별 폴더 정리 옵션 세션 저장*/
    let org_option = $('#org_option').val();
    browserAPI.storage.local.set({ BaekjoonHub_OrgOption: org_option }, () => {
        console.log(`Set Organize by ${org_option}`);
    });
});

$('#unlink a').on('click', () => {
    unlinkRepo();
    $('#unlink').hide();
    $('#success').text('Successfully unlinked your current git repo. Please create/link a new hook.');
});

/* Detect mode type */
browserAPI.storage.local.get('mode_type', (data) => {
    const mode = data.mode_type;

    if (mode && mode === 'commit') {
        /* Check if still access to repo */
        browserAPI.storage.local.get('BaekjoonHub_token', (data2) => {
            const token = data2.BaekjoonHub_token;
            if (token === null || token === undefined) {
                /* Not authorized yet. */
                $('#error').text('Authorization error - Grant BaekjoonHub access to your GitHub account to continue (click BaekjoonHub extension on the top right to proceed)');
                $('#error').show();
                $('#success').hide();
                /* Hide accordingly */
                document.getElementById('hook_mode').style.display = 'inherit';
                document.getElementById('commit_mode').style.display = 'none';
            } else {
                /* Get access to repo */
                browserAPI.storage.local.get('BaekjoonHub_hook', (repoName) => {
                    const hook = repoName.BaekjoonHub_hook;
                    if (!hook) {
                        /* Not authorized yet. */
                        $('#error').text('Improper Authorization error - Grant BaekjoonHub access to your GitHub account to continue (click BaekjoonHub extension on the top right to proceed)');
                        $('#error').show();
                        $('#success').hide();
                        /* Hide accordingly */
                        document.getElementById('hook_mode').style.display = 'inherit';
                        document.getElementById('commit_mode').style.display = 'none';
                    } else {
                        /* Username exists, at least in storage. Confirm this */
                        linkRepo(token, hook);
                    }
                });
            }
        });

        document.getElementById('hook_mode').style.display = 'none';
        document.getElementById('commit_mode').style.display = 'inherit';
    } else {
        document.getElementById('hook_mode').style.display = 'inherit';
        document.getElementById('commit_mode').style.display = 'none';
    }
});
