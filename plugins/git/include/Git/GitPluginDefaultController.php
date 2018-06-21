<?php
/**
 * Copyright (c) Enalean, 2018. All Rights Reserved.
 *
 * This file is a part of Tuleap.
 *
 * Tuleap is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * Tuleap is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Tuleap. If not, see <http://www.gnu.org/licenses/>.
 *
 */

namespace Tuleap\Git;

use EventManager;
use GitRepositoryFactory;
use HTTPRequest;
use Tuleap\Git\GitViews\ShowRepo\RepoHeader;
use Tuleap\Layout\BaseLayout;
use Tuleap\Request\DispatchableWithRequest;

class GitPluginDefaultController implements DispatchableWithRequest
{

    /**
     * @var \Tuleap\Git\RouterLink
     */
    private $router_link;
    /**
     * @var EventManager
     */
    private $event_manager;
    /**
     * @var GitRepositoryFactory
     */
    private $repository_factory;
    /**
     * @var RepoHeader
     */
    private $repo_header;

    public function __construct(RouterLink $router_link, GitRepositoryFactory $repository_factory, EventManager $event_manager, RepoHeader $repo_header)
    {
        $this->router_link        = $router_link;
        $this->event_manager      = $event_manager;
        $this->repository_factory = $repository_factory;
        $this->repo_header        = $repo_header;
    }

    /**
     * Is able to process a request routed by FrontRouter
     *
     * @param HTTPRequest $request
     * @param array $variables
     * @return void
     */
    public function process(HTTPRequest $request, BaseLayout $layout, array $variables)
    {
        \Tuleap\Project\ServiceInstrumentation::increment('git');
        \Tuleap\Instrument\Collect::increment(\GitPlugin::INSTRUMENTATION_KEY);

        $this->event_manager->processEvent(
            new GitAdditionalActionEvent(
                $request,
                $layout,
                $this->repository_factory,
                $this->repo_header
            )
        );

        $this->router_link->process($request);
    }
}
